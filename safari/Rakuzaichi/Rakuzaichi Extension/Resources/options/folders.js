var OptionsFolders = (function() {
  function makeId() {
    return 'folder-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function childrenOf(folders, parentId) {
    return folders.filter(function(folder) {
      return (folder.parentId || '') === (parentId || '');
    }).sort(function(a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function create(options) {
    options = options || {};
    var root = options.root;
    if (!root) throw new Error('folder root is required');
    var document = root.ownerDocument;
    var win = options.window || document.defaultView || window;
    var dao = options.dao || (typeof VaultDAO !== 'undefined' ? VaultDAO : null);
    var state = {
      folders: [],
      selectedFolderId: '',
      allButton: options.allButton || null,
      onSelect: typeof options.onSelect === 'function' ? options.onSelect : function() {},
      onChange: typeof options.onChange === 'function' ? options.onChange : function() {}
    };

    function selectedFolder() {
      return state.folders.find(function(folder) {
        return folder.folderId === state.selectedFolderId;
      }) || null;
    }

    function depth(folder) {
      var value = 1;
      var parentId = folder && folder.parentId;
      while (parentId) {
        value++;
        var parent = state.folders.find(function(row) {
          return row.folderId === parentId;
        });
        parentId = parent && parent.parentId;
      }
      return value;
    }

    function setSelected(folderId) {
      state.selectedFolderId = folderId || '';
      state.onSelect(state.selectedFolderId);
      render();
    }

    function attachDrop(button, folderId) {
      button.addEventListener('dragover', function(event) {
        event.preventDefault();
        button.classList.add('drop-target');
      });
      button.addEventListener('dragleave', function() {
        button.classList.remove('drop-target');
      });
      button.addEventListener('drop', async function(event) {
        event.preventDefault();
        button.classList.remove('drop-target');
        var chatId = event.dataTransfer && (event.dataTransfer.getData('application/x-rakuzaichi-chat-id') || event.dataTransfer.getData('text/plain'));
        if (!chatId || !dao || typeof dao.setChatFolder !== 'function') return;
        await dao.setChatFolder(chatId, folderId);
        await state.onChange();
      });
    }

    function renderBranch(parentId, level) {
      var folders = childrenOf(state.folders, parentId);
      if (!folders.length) return null;
      var list = document.createElement('ul');
      list.className = 'folder-list level-' + level;
      folders.forEach(function(folder) {
        var item = document.createElement('li');
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'folder-row' + (folder.folderId === state.selectedFolderId ? ' active' : '');
        button.dataset.folderId = folder.folderId;
        button.style.setProperty('--folder-level', String(level));
        button.textContent = folder.name;
        button.addEventListener('click', function() {
          setSelected(folder.folderId);
        });
        attachDrop(button, folder.folderId);
        item.appendChild(button);
        var children = renderBranch(folder.folderId, level + 1);
        if (children) item.appendChild(children);
        list.appendChild(item);
      });
      return list;
    }

    function render() {
      root.innerHTML = '';
      if (state.allButton) {
        state.allButton.classList.toggle('active', !state.selectedFolderId);
      }
      var tree = renderBranch('', 0);
      if (!tree) {
        var empty = document.createElement('p');
        empty.className = 'folder-empty';
        empty.textContent = 'No folders.';
        root.appendChild(empty);
        return;
      }
      root.appendChild(tree);
    }

    async function load() {
      state.folders = dao && typeof dao.listFolders === 'function' ? await dao.listFolders() : [];
      if (state.selectedFolderId && !selectedFolder()) state.selectedFolderId = '';
      render();
      return state.folders.slice();
    }

    async function createFolder() {
      if (!dao || typeof dao.putFolder !== 'function') return null;
      var parent = selectedFolder();
      var parentId = parent ? parent.folderId : '';
      if (parent && depth(parent) >= 3) parentId = '';
      var name = win.prompt('Folder name');
      if (!name) return null;
      var folder = await dao.putFolder({
        folderId: makeId(),
        name: name.trim(),
        parentId: parentId
      });
      await load();
      setSelected(folder.folderId);
      await state.onChange();
      return folder;
    }

    async function renameFolder() {
      if (!state.selectedFolderId || !dao || typeof dao.renameFolder !== 'function') return null;
      var current = selectedFolder();
      var name = win.prompt('Folder name', current ? current.name : '');
      if (!name) return null;
      var folder = await dao.renameFolder(state.selectedFolderId, name.trim());
      await load();
      await state.onChange();
      return folder;
    }

    async function deleteFolder() {
      if (!state.selectedFolderId || !dao || typeof dao.deleteFolder !== 'function') return false;
      if (win.confirm && !win.confirm('Delete folder?')) return false;
      var deleted = await dao.deleteFolder(state.selectedFolderId);
      state.selectedFolderId = '';
      await load();
      state.onSelect('');
      await state.onChange();
      return deleted;
    }

    function bindControls(addButton, renameButton, deleteButton, allButton) {
      if (allButton) state.allButton = allButton;
      if (addButton) addButton.addEventListener('click', createFolder);
      if (renameButton) renameButton.addEventListener('click', renameFolder);
      if (deleteButton) deleteButton.addEventListener('click', deleteFolder);
      if (allButton) {
        allButton.addEventListener('click', function() {
          setSelected('');
        });
        attachDrop(allButton, '');
      }
    }

    render();

    return {
      load: load,
      render: render,
      createFolder: createFolder,
      renameFolder: renameFolder,
      deleteFolder: deleteFolder,
      bindControls: bindControls,
      getSelectedFolderId: function() {
        return state.selectedFolderId;
      }
    };
  }

  return {
    create: create
  };
})();

if (typeof module !== 'undefined') module.exports = OptionsFolders;
