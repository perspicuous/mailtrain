'use strict';

import React, {Component} from 'react';
import {translate} from 'react-i18next';
import {
    DropdownMenu,
    Icon
} from '../lib/bootstrap-components';
import {
    MenuLink,
    requiresAuthenticatedUser,
    Title,
    Toolbar,
    withPageHelpers
} from '../lib/page';
import {
    withAsyncErrorHandler,
    withErrorHandling
} from '../lib/error-handling';
import {Table} from '../lib/table';
import moment from 'moment';
import {
    CampaignSource,
    CampaignStatus,
    CampaignType
} from "../../../shared/campaigns";
import {checkPermissions} from "../lib/permissions";
import {getCampaignLabels} from "./helpers";
import {
    tableDeleteDialogAddDeleteButton,
    tableDeleteDialogInit,
    tableDeleteDialogRender
} from "../lib/modals";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class List extends Component {
    constructor(props) {
        super(props);

        const t = props.t;

        const { campaignTypeLabels, campaignStatusLabels } = getCampaignLabels(t);
        this.campaignTypeLabels = campaignTypeLabels;
        this.campaignStatusLabels = campaignStatusLabels;

        this.state = {};
        tableDeleteDialogInit(this);
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const result = await checkPermissions({
            createCampaign: {
                entityTypeId: 'namespace',
                requiredOperations: ['createCampaign']
            }
        });

        this.setState({
            createPermitted: result.data.createCampaign
        });
    }

    componentDidMount() {
        // noinspection JSIgnoredPromiseFromCall
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;

        const columns = [
            { data: 1, title: t('Name') },
            { data: 2, title: t('ID'), render: data => <code>{data}</code> },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Type'), render: data => this.campaignTypeLabels[data] },
            {
                data: 5,
                title: t('Status'),
                render: (data, display, rowData) => {
                    if (data === CampaignStatus.SCHEDULED) {
                        const scheduled = rowData[6];
                        if (scheduled && new Date(scheduled) > new Date()) {
                            return t('Sending scheduled');
                        } else {
                            return t('Sending');
                        }
                    } else {
                        return this.campaignStatusLabels[data];
                    }
                }
            },
            { data: 8, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 9, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[10];
                    const campaignType = data[4];
                    const campaignSource = data[7];

                    if (perms.includes('viewStats')) {
                        actions.push({
                            label: <Icon icon="send" title={t('Status')}/>,
                            link: `/campaigns/${data[0]}/status`
                        });
                    }

                    if (perms.includes('edit')) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')}/>,
                            link: `/campaigns/${data[0]}/edit`
                        });
                    }

                    if (perms.includes('edit') && (campaignSource === CampaignSource.CUSTOM || campaignSource === CampaignSource.CUSTOM_FROM_TEMPLATE || campaignSource === CampaignSource.CUSTOM_FROM_CAMPAIGN)) {
                        actions.push({
                            label: <Icon icon="align-center" title={t('Content')}/>,
                            link: `/campaigns/${data[0]}/content`
                        });
                    }

                    if (perms.includes('viewFiles') && (campaignSource === CampaignSource.CUSTOM || campaignSource === CampaignSource.CUSTOM_FROM_TEMPLATE || campaignSource === CampaignSource.CUSTOM_FROM_CAMPAIGN)) {
                        actions.push({
                            label: <Icon icon="hdd" title={t('Files')}/>,
                            link: `/campaigns/${data[0]}/files`
                        });
                    }

                    if (perms.includes('viewAttachments')) {
                        actions.push({
                            label: <Icon icon="paperclip" title={t('Attachments')}/>,
                            link: `/campaigns/${data[0]}/attachments`
                        });
                    }

                    if (campaignType === CampaignType.TRIGGERED && perms.includes('viewTriggers')) {
                        actions.push({
                            label: <Icon icon="flash" title={t('Triggers')}/>,
                            link: `/campaigns/${data[0]}/triggers`
                        });
                    }

                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share-alt" title={t('Share')}/>,
                            link: `/campaigns/${data[0]}/share`
                        });
                    }

                    tableDeleteDialogAddDeleteButton(actions, this, perms, data[0], data[1]);

                    return actions;
                }
            }
        ];

        return (
            <div>
                {tableDeleteDialogRender(this, `rest/campaigns`, t('Deleting campaign ...'), t('Campaign deleted'))}
                <Toolbar>
                    {this.state.createPermitted &&
                    <DropdownMenu className="btn-primary" label={t('Create Campaign')}>
                        <MenuLink to="/campaigns/create-regular">{t('Regular')}</MenuLink>
                        <MenuLink to="/campaigns/create-rss">{t('RSS')}</MenuLink>
                        <MenuLink to="/campaigns/create-triggered">{t('Triggered')}</MenuLink>
                    </DropdownMenu>
                    }
                </Toolbar>

                <Title>{t('Campaigns')}</Title>

                <Table ref={node => this.table = node} withHeader dataUrl="rest/campaigns-table" columns={columns} />
            </div>
        );
    }
}