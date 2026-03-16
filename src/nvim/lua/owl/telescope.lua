local config = require('owl.config')
local M = {}
function M.pick(cfg, results) -- telescope picker for tags
  local ok, _ = pcall(require, 'telescope')
  if not ok then
    vim.notify('owl: telescope.nvim not found', vim.log.levels.WARN)
    return
  end
  local pickers = require('telescope.pickers')
  local finders = require('telescope.finders')
  local conf = require('telescope.config').values
  local actions = require('telescope.actions')
  local action_state = require('telescope.actions.state')
  local entries = {}
  local prefixes = config.getAllPrefixes(cfg)
  table.sort(prefixes, function(a, b) -- sort by priority
    return (cfg.priority[a] or 99) < (cfg.priority[b] or 99)
  end)
  for _, p in ipairs(prefixes) do
    local tags = results[p] or {}
    for _, tag in ipairs(tags) do
      table.insert(entries, {prefix=p, text=tag.text, lnum=tag.lnum, buf=tag.buf})
    end
  end
  pickers.new({}, {
    prompt_title = 'Owl Tags',
    finder = finders.new_table({
      results = entries,
      entry_maker = function(e)
        local display = string.format('[%s] L%d: %s', e.prefix, e.lnum, e.text)
        return {value=e, display=display, ordinal=display, lnum=e.lnum}
      end,
    }),
    sorter = conf.generic_sorter({}),
    attach_mappings = function(prompt_bufnr)
      actions.select_default:replace(function() -- jump to tag on select
        actions.close(prompt_bufnr)
        local sel = action_state.get_selected_entry()
        if sel and sel.value then
          if sel.value.buf and vim.api.nvim_buf_is_valid(sel.value.buf) then
            vim.api.nvim_set_current_buf(sel.value.buf)
          end
          vim.api.nvim_win_set_cursor(0, {sel.value.lnum, 0})
        end
      end)
      return true
    end,
  }):find()
end
return M
