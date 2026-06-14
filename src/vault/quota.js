var VaultDAORef = (typeof VaultDAO !== 'undefined') ? VaultDAO : null;
if (!VaultDAORef && typeof require !== 'undefined') {
  VaultDAORef = require('./dao.js').VaultDAO;
}

function createVaultQuota(options) {
  options = options || {};
  var dao = options.dao || VaultDAORef;
  var nav = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
  var MB = 1024 * 1024;

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  async function getQuotaUsage() {
    if (!nav || !nav.storage || typeof nav.storage.estimate !== 'function') {
      return { usageMB: 0, quotaMB: 0, percent: 0, supported: false };
    }

    var estimate = await nav.storage.estimate();
    var usage = estimate && estimate.usage ? estimate.usage : 0;
    var quota = estimate && estimate.quota ? estimate.quota : 0;
    return {
      usageMB: round(usage / MB),
      quotaMB: round(quota / MB),
      percent: quota > 0 ? round((usage / quota) * 100) : 0,
      supported: true
    };
  }

  async function autoPruneVault() {
    if (!dao) throw new Error('Vault DAO is unavailable');

    var before = await getQuotaUsage();
    if (!before.supported || before.percent <= 90) {
      return { pruned: false, deletedChatIds: [], before: before, after: before };
    }

    var deletedChatIds = [];
    var chats = await dao.listChats();
    var candidates = chats.filter(function(chat) {
      return !chat.pinned;
    }).sort(function(a, b) {
      return String(a.capturedAt || '').localeCompare(String(b.capturedAt || ''));
    });

    var after = before;
    for (var i = 0; i < candidates.length; i++) {
      await dao.deleteChat(candidates[i].chatId);
      deletedChatIds.push(candidates[i].chatId);
      after = await getQuotaUsage();
      if (after.percent < 75) break;
    }

    return {
      pruned: deletedChatIds.length > 0,
      deletedChatIds: deletedChatIds,
      before: before,
      after: after
    };
  }

  return {
    getQuotaUsage: getQuotaUsage,
    autoPruneVault: autoPruneVault
  };
}

var VaultQuota = createVaultQuota();

if (typeof module !== 'undefined') {
  module.exports = {
    createVaultQuota: createVaultQuota,
    VaultQuota: VaultQuota
  };
}
