import { EndorsementAvatar } from './EndorsementAvatar'
import styles from './EndorsementBanner.module.css'
import { TabBar, TabSpec } from '@/components/common/tab_bar/TabBar'
import { Endorsement, EndorsementType, InitiativeType } from '@/contracts/data'
import { stateOptions } from '@/models'

interface EndorsementBannerProps {
    endorsement: Endorsement
    selectedTab?: string
    tabs?: TabSpec[]
    onTabChange?: (key: string) => void
}

const initiativeLevelLabels: Record<InitiativeType, string> = {
    [InitiativeType.State]: 'State Initiative',
    [InitiativeType.National]: 'National Initiative',
}

const endorsementLevelLabels: Record<EndorsementType, string> = {
    [EndorsementType.PVPledge]: 'PV Pledge',
    [EndorsementType.Endorsement]: 'Endorsement',
    [EndorsementType.Recommendation]: 'Recommendation',
    [EndorsementType.None]: 'None',
}

const stateNames = new Map(
    stateOptions.map((option) => [option.value, option.label])
)

export function EndorsementBanner({
    endorsement,
    selectedTab,
    tabs,
    onTabChange,
}: EndorsementBannerProps) {
    return (
        <div className={styles.headerTop}>
            <div className={styles.cardStyle}>
                <EndorsementAvatar endorsement={endorsement} size={72} />
                <div className={styles.userInfo}>
                    <h1 className={styles.headerUserName}>
                        {endorsement.name || 'New Endorsement'}
                    </h1>
                    <h2 className={styles.headerUserUsername}>
                        {stateNames.get(endorsement.state) ??
                            (endorsement.state
                                ? endorsement.state
                                : 'No state selected')}
                    </h2>
                </div>
            </div>
            <div className={styles.roleList}>
                <span className={styles.rolePill}>
                    {initiativeLevelLabels[endorsement.initiativeLevel]}
                </span>
                <span className={styles.rolePill}>
                    {endorsementLevelLabels[endorsement.endorsementLevel]}
                </span>
            </div>
            {tabs && tabs.length > 0 && selectedTab && onTabChange && (
                <TabBar
                    tabs={tabs}
                    value={selectedTab}
                    onChange={onTabChange}
                />
            )}
        </div>
    )
}
