local config = require('owl.config')
local M = {}
M._cfg = nil
function M.setup(opts) -- merge user opts, register commands
  M._cfg = config.get(opts)
  M._register_commands()
end
function M.auto_setup() -- lazy-friendly: default config, register commands
  if not M._cfg then M._cfg = config.get({}) end
  M._register_commands()
end
function M._register_commands()
  vim.api.nvim_create_user_command('OwlScan', function()
    local scanner = require('owl.scanner')
    local ui = require('owl.ui')
    local results = scanner.scan_buffer(M._cfg)
    ui.open(M._cfg, results)
  end, {desc='Owl: scan current buffer'})
  vim.api.nvim_create_user_command('OwlScanWorkspace', function()
    local scanner = require('owl.scanner')
    local ui = require('owl.ui')
    local results = scanner.scan_workspace(M._cfg)
    ui.open(M._cfg, results)
  end, {desc='Owl: scan all loaded buffers'})
  vim.api.nvim_create_user_command('OwlTelescope', function()
    local scanner = require('owl.scanner')
    local telescope = require('owl.telescope')
    local results = scanner.scan_buffer(M._cfg)
    telescope.pick(M._cfg, results)
  end, {desc='Owl: telescope picker'})
  vim.api.nvim_create_user_command('OwlHighlight', function()
    local highlight = require('owl.highlight')
    highlight.apply(M._cfg)
  end, {desc='Owl: highlight tags in buffer'})
end
return M
