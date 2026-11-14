export const permissionGroups = [
  { title: 'bag.title', keys: ['viewBag', 'editBag'] },
  { title: 'roomSettings.tabs.room', keys: ['editNickname', 'editRoom', 'manageSessions', 'archiveRoom'] },
  { title: 'roomSettings.tabs.dices', keys: ['manageDice', 'manageDiceCategories'] },
  { title: 'roomSettings.tabs.rollAwards', keys: ['viewRollAwards', 'manageRollAwards', 'copyRollAwards', 'assignRollAwards'] },
  { title: 'roomSettings.tabs.criticals', keys: ['manageCriticals'] },
  { title: 'roomSettings.tabs.bonusPoints', keys: ['manageBonusPoints'] },
] as const;
