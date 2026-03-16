local M = {}
M.builtin_prefixes = {'TODO','FIXME','TEMP','REF','REV'}
M.fallback_colors = {'#ff6b6b','#ffa06b','#ffd93d','#6bff6b','#6bd9ff','#b06bff','#ff6bb0','#c8c8c8'}
M.colorschemes = {
  gruvbox = {TODO='#FABD2F',FIXME='#FB4934',TEMP='#8EC07C',REF='#83A598',REV='#D3869B'},
  everforest = {TODO='#d8a657',FIXME='#e67e80',TEMP='#a7c080',REF='#7fbbb3',REV='#d699b6'},
  tokyoNight = {TODO='#e0af68',FIXME='#f7768e',TEMP='#9ece6a',REF='#7aa2f7',REV='#bb9af7'},
  atomDark = {TODO='#e5c07b',FIXME='#e06c75',TEMP='#98c379',REF='#61afef',REV='#c678dd'},
  monokai = {TODO='#f4bf75',FIXME='#f92672',TEMP='#a6e22e',REF='#66d9ef',REV='#ae81ff'},
  github = {TODO='#6f42c1',FIXME='#d73a49',TEMP='#28a745',REF='#0366d6',REV='#005cc5'},
  ayu = {TODO='#ff9940',FIXME='#f07178',TEMP='#aad94c',REF='#39bae6',REV='#c296eb'},
  dracula = {TODO='#f1fa8c',FIXME='#ff5555',TEMP='#50fa7b',REF='#8be9fd',REV='#bd93f9'},
  rosePine = {TODO='#f6c177',FIXME='#eb6f92',TEMP='#9ccfd8',REF='#31748f',REV='#c4a7e7'},
  spacemacs = {TODO='#dcaeea',FIXME='#fc5c94',TEMP='#86dc2f',REF='#36c6d3',REV='#a9a1e1'},
}
M.defaults = {
  colorscheme = 'gruvbox',
  custom_prefixes = {},
  priority = {FIXME=1,TODO=2,REV=3,TEMP=4,REF=5},
}
function M.get(opts) -- merge user opts into defaults
  local cfg = vim.tbl_deep_extend('force', {}, M.defaults, opts or {})
  for i, p in ipairs(cfg.custom_prefixes) do -- assign priority to custom prefixes
    if not cfg.priority[p] then cfg.priority[p] = #M.builtin_prefixes + i end
  end
  return cfg
end
function M.getAllPrefixes(cfg) -- builtin + custom
  local all = vim.list_extend({}, M.builtin_prefixes)
  for _, p in ipairs(cfg.custom_prefixes or {}) do table.insert(all, p) end
  return all
end
function M.getColor(cfg, prefix) -- resolve color for prefix
  local cs = M.colorschemes[cfg.colorscheme] or M.colorschemes.gruvbox
  if cs[prefix] then return cs[prefix] end
  local idx = 0 -- fallback for custom tags
  for i, p in ipairs(cfg.custom_prefixes or {}) do
    if p == prefix then idx = i; break end
  end
  return M.fallback_colors[((idx - 1) % #M.fallback_colors) + 1]
end
return M
