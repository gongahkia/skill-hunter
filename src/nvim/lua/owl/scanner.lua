local config = require('owl.config')
local M = {}
function M.scan_buffer(cfg, bufnr) -- scan single buffer for tag annotations
  bufnr = bufnr or 0
  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
  local prefixes = config.getAllPrefixes(cfg)
  local results = {}
  for _, p in ipairs(prefixes) do results[p] = {} end
  for lnum, line in ipairs(lines) do
    local trimmed = line:match('^%s*(.-)%s*$') or ''
    for _, p in ipairs(prefixes) do
      local pat = '^' .. p:lower() -- case-insensitive prefix match
      if trimmed:lower():find(pat) then
        table.insert(results[p], {text=trimmed, lnum=lnum})
        break
      end
    end
  end
  return results
end
function M.scan_workspace(cfg) -- scan all loaded buffers
  local merged = {}
  local prefixes = config.getAllPrefixes(cfg)
  for _, p in ipairs(prefixes) do merged[p] = {} end
  for _, bufnr in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_loaded(bufnr) then
      local res = M.scan_buffer(cfg, bufnr)
      local bname = vim.api.nvim_buf_get_name(bufnr)
      for _, p in ipairs(prefixes) do
        for _, tag in ipairs(res[p] or {}) do
          tag.buf = bufnr
          tag.file = bname
          table.insert(merged[p], tag)
        end
      end
    end
  end
  return merged
end
return M
