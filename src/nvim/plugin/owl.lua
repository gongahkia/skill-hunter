if vim.g.owl_loaded then return end
vim.g.owl_loaded = true
require('owl').auto_setup()
