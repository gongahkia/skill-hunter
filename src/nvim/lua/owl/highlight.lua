local config = require('owl.config')
local M = {}
function M.apply(cfg) -- create highlight groups and matchadd for current buffer
  local prefixes = config.getAllPrefixes(cfg)
  for _, p in ipairs(prefixes) do
    local color = config.getColor(cfg, p)
    local hl = 'Owl' .. p
    vim.api.nvim_set_hl(0, hl, {fg=color, bold=true})
    vim.fn.matchadd(hl, '\\c\\<' .. p .. '\\>') -- case-insensitive match
  end
end
return M
