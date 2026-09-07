'use client'

import {
    useMembershipPanel,
    usePendingUpdates,
    useSaveMemberships,
    MembershipTableOptions,
} from './hooks'
import { EditController, Member } from './membership.types'
import { buildColumns, FULFILLMENT_CATEGORY } from './membershipColumns'
import styles from './page.module.css'
import {
    DropdownButton,
    DropdownOverlay,
    ToggleGroup,
} from '@/components/common'
import { Table } from '@/components/common/table'
import { cn } from '@/util'
import { useMemo } from 'react'
import { FaEdit, FaSave, FaTrashAlt } from 'react-icons/fa'

const showHideChoices = [
    { value: true, label: 'Show' },
    { value: false, label: 'Hide' },
]

const tableOptionRows: {
    key: keyof MembershipTableOptions
    label: string
    ariaLabel: string
    choices: { value: boolean; label: string }[]
}[] = [
    {
        key: 'showRowNumber',
        label: 'Row column',
        ariaLabel: 'Row Column',
        choices: showHideChoices,
    },
    {
        key: 'showStatus',
        label: 'Status columns',
        ariaLabel: 'Member Eligibility Columns',
        choices: showHideChoices,
    },
    {
        key: 'showConfirmed',
        label: 'Confirmed columns',
        ariaLabel: 'Member Details Confirmed Columns',
        choices: showHideChoices,
    },
    {
        key: 'showFulfilled',
        label: 'Benefits fulfilled tag',
        ariaLabel: 'Tag Groups',
        choices: showHideChoices,
    },
    {
        key: 'collapseFulfillment',
        label: 'Fulfillment columns',
        ariaLabel: 'Fulfillment columns',
        choices: [
            { value: false, label: 'Expand' },
            { value: true, label: 'Collapse' },
        ],
    },
]

function EditToolbar({
    members,
    editController,
    saveMutation,
    discardEdits,
}: {
    members: Member[]
    editController: EditController
    saveMutation: ReturnType<typeof useSaveMemberships>
    discardEdits: () => void
}) {
    const { pendingUpdates, hasInvalidEdits } = usePendingUpdates(
        editController,
        members
    )

    return (
        <>
            <span className={styles.editStatus}>
                {hasInvalidEdits
                    ? 'Fix invalid fields to save'
                    : pendingUpdates.length === 0
                      ? 'No changes'
                      : `${pendingUpdates.length} pending change${pendingUpdates.length === 1 ? '' : 's'}`}
            </span>
            <button
                type="button"
                className={styles.toolbarButton}
                disabled={
                    hasInvalidEdits ||
                    pendingUpdates.length === 0 ||
                    saveMutation.isPending
                }
                onClick={() => saveMutation.mutate(pendingUpdates)}
            >
                <FaSave /> {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            <button
                type="button"
                className={cn(styles.toolbarButton, styles.discardButton)}
                disabled={saveMutation.isPending}
                onClick={discardEdits}
            >
                <FaTrashAlt /> Discard Changes
            </button>
        </>
    )
}

export default function Page() {
    const {
        members,
        totalEntries,
        options,
        setOption,
        tableMode,
        setTableMode,
        editController,
        saveMutation,
        discardEdits,
        hasNextPage,
        isFetchingNextPage,
        sentinelRef,
    } = useMembershipPanel()

    const columns = useMemo(
        () => buildColumns({ options, tableMode, edit: editController }),
        [options, tableMode, editController]
    )

    const collapsedCategories = useMemo(
        () => (options.collapseFulfillment ? [FULFILLMENT_CATEGORY] : []),
        [options.collapseFulfillment]
    )

    return (
        <div className={styles.panelContents}>
            <div className={styles.panelHeader}>
                <div className={styles.breadcrumbs}>
                    <span className={styles.prominentBreadcrumb}>Admin</span>
                    <span className={styles.breadcrumbSeperator}>/</span>
                    <span className={styles.panelBreadcrumb}>Membership</span>
                </div>

                <div className={styles.panelTimestamp}>
                    Entries Loaded: {members.length.toLocaleString()}
                    {totalEntries != null &&
                        ` of ${totalEntries.toLocaleString()}`}
                </div>
            </div>
            <div className={styles.scrollView}>
                <div className={styles.galleryHeader}>
                    <div className={styles.galleryHeading}>
                        <h1 className={styles.galleryTitle}>Membership</h1>
                        <p className={styles.gallerySubTitle}>
                            Manage membership records and details.
                        </p>
                    </div>

                    <div className={styles.tableToolbar}>
                        {tableMode === 'edit' ? (
                            <EditToolbar
                                members={members}
                                editController={editController}
                                saveMutation={saveMutation}
                                discardEdits={discardEdits}
                            />
                        ) : (
                            <button
                                type="button"
                                className={styles.toolbarButton}
                                onClick={() => setTableMode('edit')}
                            >
                                <FaEdit /> Edit
                            </button>
                        )}
                        <DropdownButton
                            buttonVariant="minimal"
                            label="Table Options"
                            menu={({ closeDropdown }) => (
                                <DropdownOverlay
                                    className={styles.tableOptionsBox}
                                    label="Table Options"
                                    onClose={closeDropdown}
                                    bodyClassName={styles.tableOptionsBody}
                                    body={tableOptionRows.map(
                                        ({
                                            key,
                                            label,
                                            ariaLabel,
                                            choices,
                                        }) => (
                                            <div
                                                key={key}
                                                className={
                                                    styles.tableOptionRow
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles.tableOptionLabel
                                                    }
                                                >
                                                    {label}
                                                </span>
                                                <ToggleGroup<boolean>
                                                    ariaLabel={ariaLabel}
                                                    orientation="horizontal"
                                                    value={options[key]}
                                                    options={choices}
                                                    onChange={(value) =>
                                                        setOption(key, value)
                                                    }
                                                />
                                            </div>
                                        )
                                    )}
                                />
                            )}
                        />
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <Table
                        columns={columns}
                        data={members}
                        rowKey={(m) => m.id}
                        collapsedCategories={collapsedCategories}
                        mode={tableMode}
                        footer={
                            hasNextPage && (
                                <div
                                    className={styles.loadMore}
                                    ref={sentinelRef}
                                >
                                    {isFetchingNextPage &&
                                        'Loading more membership records...'}
                                </div>
                            )
                        }
                    />
                </div>
            </div>
        </div>
    )
}
