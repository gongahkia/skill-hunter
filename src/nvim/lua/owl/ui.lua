local config = require('owl.config')
local M = {}
local function sorted_prefixes(cfg, results) -- sort by priority
  local plist = {}
  for p, tags in pairs(results) do
    if #tags > 0 then table.insert(plist, p) end
  end
  table.sort(plist, function(a, b)
    return (cfg.priority[a] or 99) < (cfg.priority[b] or 99)
  end)
  return plist
end
local function build_lines(cfg, results) -- build display lines + metadata
  local lines, meta = {}, {}
  local plist = sorted_prefixes(cfg, results)
  local stats = {}
  local total = 0
  for _, p in ipairs(plist) do
    local n = #results[p]; total = total + n
    table.insert(stats, p .. ': ' .. n)
  end
  local stat_line = total .. ' tags | ' .. table.concat(stats, ' | ')
  table.insert(lines, stat_line)
  table.insert(meta, {type='stats'})
  table.insert(lines, '')
  table.insert(meta, {type='blank'})
  for _, p in ipairs(plist) do
    table.insert(lines, '[ ' .. p .. ' ]')
    table.insert(meta, {type='header', prefix=p})
    for _, tag in ipairs(results[p]) do
      table.insert(lines, '  ' .. tag.lnum .. ': ' .. tag.text)
      table.insert(meta, {type='tag', prefix=p, lnum=tag.lnum, buf=tag.buf})
    end
    table.insert(lines, '')
    table.insert(meta, {type='blank'})
  end
  return lines, meta
end
function M.open(cfg, results) -- open floating window with scan results
  local lines, meta = build_lines(cfg, results)
  local ew = vim.o.columns
  local eh = vim.o.lines
  local w = math.floor(ew * 0.6)
  local h = math.floor(eh * 0.8)
  local row = math.floor((eh - h) / 2)
  local col = math.floor((ew - w) / 2)
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  vim.bo[buf].bufhidden = 'wipe'
  local win = vim.api.nvim_open_win(buf, true, {
    relative='editor', width=w, height=h, row=row, col=col,
    style='minimal', border='rounded', title=' Owl ', title_pos='center',
  })
  local ns = vim.api.nvim_create_namespace('owl_ui')
  for i, m in ipairs(meta) do -- apply highlights via extmarks
    if m.prefix then
      local hl = 'Owl' .. m.prefix
      vim.api.nvim_buf_add_highlight(buf, ns, hl, i - 1, 0, -1)
    end
  end
  local function close() -- close float
    if vim.api.nvim_win_is_valid(win) then vim.api.nvim_win_close(win, true) end
  end
  vim.keymap.set('n', 'q', close, {buffer=buf, nowait=true})
  vim.keymap.set('n', '<Esc>', close, {buffer=buf, nowait=true})
  vim.keymap.set('n', '<CR>', function() -- jump to tag line
    local row_idx = vim.api.nvim_win_get_cursor(win)[1]
    local m = meta[row_idx]
    if m and m.type == 'tag' then
      close()
      if m.buf and vim.api.nvim_buf_is_valid(m.buf) then
        vim.api.nvim_set_current_buf(m.buf)
      end
      vim.api.nvim_win_set_cursor(0, {m.lnum, 0})
    end
  end, {buffer=buf, nowait=true})
  vim.keymap.set('n', '/', function() -- native buffer search
    vim.cmd('/')
  end, {buffer=buf, nowait=true})
end
return M
