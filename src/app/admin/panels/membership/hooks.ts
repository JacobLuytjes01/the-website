'use client'

import {
    buildPendingUpdates,
    isValidAddressDraft,
    isValidPhone,
    mapPacketToMember,
} from './membership.helpers'
import {
    DescribeChange,
    EditController,
    HistoryEntry,
    Member,
    MemberEdits,
    MembershipTableMode,
    PendingUpdate,
} from './membership.types'
import { User, zUser } from '@/contracts/data'
import {
    zMembershipsResponsePacket,
    zPaginatedResponse,
} from '@/contracts/responses'
import { useCurrentUser, useFetch, useInfiniteScroll } from '@/util/hooks'
import {
    skipToken,
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

const HISTORY_STALE_TIME = 5 * 60 * 1000
const HISTORY_LIMIT = 5
const PAGE_SIZE = 25

export function useFieldHistory<T extends HistoryEntry>({
    userId,
    selectHistory,
    describeChange,
}: {
    userId?: number
    selectHistory: (user: User) => T[]
    describeChange: DescribeChange<T>
}) {
    const { ready, onGet } = useFetch()

    const userQuery = useQuery({
        queryKey: ['/users/:userId', userId, { includeHistory: true }],
        queryFn:
            ready && userId != null
                ? ({ signal }: { signal: AbortSignal }) =>
                      onGet('/users/:userId', zUser, {
                          params: { userId },
                          query: { includeHistory: true },
                          signal,
                      })
                : skipToken,
        staleTime: HISTORY_STALE_TIME,
    })

    const history = useMemo(() => {
        const user = userQuery.data
        const ascending = (user ? selectHistory(user) : [])
            .slice()
            .sort(
                (a, b) =>
                    a.historyWhenUpdatedUtc.getTime() -
                    b.historyWhenUpdatedUtc.getTime()
            )

        const entries: {
            update: T
            label: string
            value: string
        }[] = []
        let previous: T | undefined

        for (const update of ascending) {
            const change = describeChange(update, previous)
            if (!change) continue
            entries.push({ update, ...change })
            previous = update
        }

        return entries.reverse().slice(0, HISTORY_LIMIT)
    }, [userQuery.data, selectHistory, describeChange])

    return {
        history,
        isPending: userQuery.isPending,
        isError: userQuery.isError,
    }
}

export function useMemberEdits() {
    const [edits, setEdits] = useState<Record<string, MemberEdits>>({})

    const editController = useMemo<EditController>(
        () => ({
            draftOf: (member: Member) =>
                member.donorEmail != null
                    ? (edits[member.donorEmail] ?? {})
                    : {},
            update: (member: Member, patch: MemberEdits) => {
                const donorEmail = member.donorEmail
                if (donorEmail == null) return
                setEdits((current) => ({
                    ...current,
                    [donorEmail]: { ...current[donorEmail], ...patch },
                }))
            },
        }),
        [edits]
    )

    const clearEdits = useCallback(() => setEdits({}), [])

    return { edits, editController, clearEdits }
}

export function useSaveMemberships(onSaved: () => void) {
    const { onPatch } = useFetch()
    const loggedInUser = useCurrentUser()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (updates: PendingUpdate[]) => {
            const metaData = {
                dataSource: 'Membership Panel',
                userWhoUpdatedId: loggedInUser.data?.id,
            }

            for (const { donorEmail, userId, user, membership } of updates) {
                if (user && userId != null) {
                    await onPatch(
                        '/users/:userId',
                        { ...user, metaData },
                        zUser,
                        { params: { userId } }
                    )
                }

                if (membership) {
                    await onPatch(
                        '/actblue/donors/:donorEmail/membership',
                        { ...membership, metaData },
                        null,
                        { params: { donorEmail } }
                    )
                }
            }
        },
        onSuccess: async () => {
            onSaved()
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ['/actblue/memberships'],
                }),
                queryClient.invalidateQueries({
                    queryKey: ['/users/:userId'],
                }),
            ])
        },
        onError: (error) => console.error(error),
    })
}

export interface MembershipTableOptions {
    showRowNumber: boolean
    showStatus: boolean
    showConfirmed: boolean
    showFulfilled: boolean
    collapseFulfillment: boolean
}

const defaultTableOptions: MembershipTableOptions = {
    showRowNumber: false,
    showStatus: false,
    showConfirmed: false,
    showFulfilled: true,
    collapseFulfillment: false,
}

function useMembershipsQuery() {
    const { ready, onGet } = useFetch()

    const query = useInfiniteQuery({
        queryKey: ['/actblue/memberships', { limit: PAGE_SIZE }],
        queryFn: ({ pageParam, signal }) =>
            onGet(
                '/actblue/memberships',
                zPaginatedResponse(zMembershipsResponsePacket),
                { query: { page: pageParam, limit: PAGE_SIZE }, signal }
            ),
        initialPageParam: 0,
        getNextPageParam: (lastPage, pages) => {
            const loadedCount = pages.reduce(
                (total, page) => total + page.data.length,
                0
            )
            return loadedCount < lastPage.count ? pages.length : undefined
        },
        enabled: ready,
    })

    const members = useMemo(
        () =>
            (query.data?.pages ?? [])
                .flatMap((page) => page.data)
                .map(mapPacketToMember),
        [query.data]
    )

    return { query, members, totalEntries: query.data?.pages[0]?.count }
}

export function useMembershipPanel() {
    const [options, setOptions] =
        useState<MembershipTableOptions>(defaultTableOptions)
    const [tableMode, setTableMode] = useState<MembershipTableMode>('view')
    const { edits, editController, clearEdits } = useMemberEdits()
    const { query, members, totalEntries } = useMembershipsQuery()

    const { fetchNextPage, hasNextPage, isFetchingNextPage } = query
    const { sentinelRef } = useInfiniteScroll<HTMLDivElement>({
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    })

    const setOption = useCallback(
        <K extends keyof MembershipTableOptions>(
            key: K,
            value: MembershipTableOptions[K]
        ) => setOptions((current) => ({ ...current, [key]: value })),
        []
    )

    const pendingUpdates = useMemo(
        () => buildPendingUpdates(members, edits),
        [members, edits]
    )

    const hasInvalidEdits = useMemo(
        () =>
            Object.values(edits).some(
                (draft) =>
                    (draft.userPhone != null &&
                        !isValidPhone(draft.userPhone)) ||
                    (draft.address != null &&
                        !isValidAddressDraft(draft.address))
            ),
        [edits]
    )

    const stopEditing = useCallback(() => {
        clearEdits()
        setTableMode('view')
    }, [clearEdits])

    const saveMutation = useSaveMemberships(stopEditing)

    return {
        members,
        totalEntries,
        options,
        setOption,
        tableMode,
        setTableMode,
        editController,
        pendingUpdates,
        hasInvalidEdits,
        saveMutation,
        discardEdits: stopEditing,
        hasNextPage,
        isFetchingNextPage,
        sentinelRef,
    }
}
