" built-in tag prefixes
let g:owl_tags = ['TODO', 'FIXME', 'TEMP', 'REF', 'REV']
" user-configurable custom tags (append to this in vimrc)
if !exists('g:owl_custom_tags')
  let g:owl_custom_tags = []
endif
" priority order for display sorting
let s:priority = {'FIXME': 1, 'TODO': 2, 'REV': 3, 'TEMP': 4, 'REF': 5}
" colorschemes (gruvbox default)
let s:schemes = {
  \ 'gruvbox':    {'TODO': '#FABD2F', 'FIXME': '#FB4934', 'TEMP': '#8EC07C', 'REF': '#83A598', 'REV': '#D3869B'},
  \ 'everforest': {'TODO': '#d8a657', 'FIXME': '#e67e80', 'TEMP': '#a7c080', 'REF': '#7fbbb3', 'REV': '#d699b6'},
  \ 'tokyoNight': {'TODO': '#e0af68', 'FIXME': '#f7768e', 'TEMP': '#9ece6a', 'REF': '#7aa2f7', 'REV': '#bb9af7'},
  \ 'atomDark':   {'TODO': '#e5c07b', 'FIXME': '#e06c75', 'TEMP': '#98c379', 'REF': '#61afef', 'REV': '#c678dd'},
  \ 'monokai':    {'TODO': '#f4bf75', 'FIXME': '#f92672', 'TEMP': '#a6e22e', 'REF': '#66d9ef', 'REV': '#ae81ff'},
  \ 'github':     {'TODO': '#6f42c1', 'FIXME': '#d73a49', 'TEMP': '#28a745', 'REF': '#0366d6', 'REV': '#005cc5'},
  \ 'ayu':        {'TODO': '#ff9940', 'FIXME': '#f07178', 'TEMP': '#aad94c', 'REF': '#39bae6', 'REV': '#c296eb'},
  \ 'dracula':    {'TODO': '#f1fa8c', 'FIXME': '#ff5555', 'TEMP': '#50fa7b', 'REF': '#8be9fd', 'REV': '#bd93f9'},
  \ 'rosePine':   {'TODO': '#f6c177', 'FIXME': '#eb6f92', 'TEMP': '#9ccfd8', 'REF': '#31748f', 'REV': '#c4a7e7'},
  \ 'spacemacs':  {'TODO': '#dcaeea', 'FIXME': '#fc5c94', 'TEMP': '#86dc2f', 'REF': '#36c6d3', 'REV': '#a9a1e1'},
  \ }
" active colorscheme (user can override via let g:owl_colorscheme = 'dracula')
if !exists('g:owl_colorscheme')
  let g:owl_colorscheme = 'gruvbox'
endif
let s:fallback_colors = ['#ff6b6b', '#ffa06b', '#ffd93d', '#6bff6b', '#6bd9ff', '#b06bff', '#ff6bb0', '#c8c8c8']

function! s:AllTags()
  return g:owl_tags + g:owl_custom_tags
endfunction

function! s:GetPriority(tag)
  return get(s:priority, a:tag, 99)
endfunction

function! s:GetColor(tag)
  let l:scheme = get(s:schemes, g:owl_colorscheme, s:schemes['gruvbox'])
  if has_key(l:scheme, a:tag)
    return l:scheme[a:tag]
  endif
  let l:idx = index(g:owl_custom_tags, a:tag)
  return l:idx >= 0 ? s:fallback_colors[l:idx % len(s:fallback_colors)] : '#ffffff'
endfunction

function! GetTaggedLines()
  let l:lines = getline(1, '$')
  let l:tags = {}
  let l:all_tags = s:AllTags()
  let l:lnum = 0
  for l:line in l:lines
    let l:lnum += 1
    for l:tag in l:all_tags
      if l:line =~? '\<' . l:tag . '\>'
        let l:sanitised = substitute(l:line, '.*\<' . l:tag . '\>\s*', '', '')
        if !empty(l:sanitised)
          if !has_key(l:tags, l:tag)
            let l:tags[l:tag] = []
          endif
          call add(l:tags[l:tag], {'text': l:sanitised, 'lnum': l:lnum})
        endif
      endif
    endfor
  endfor
  call DisplayTags(l:tags)
endfunction

function! s:ComparePriority(a, b)
  return s:GetPriority(a[0]) - s:GetPriority(b[0])
endfunction

function! DisplayTags(tags)
  enew
  setlocal buftype=nofile bufhidden=wipe noswapfile nowrap
  let l:sorted = sort(items(a:tags), 's:ComparePriority')
  if empty(l:sorted)
    call append(0, 'Tags')
    call append(2, 'Owl found no tagged lines.')
    nnoremap <buffer> <silent> q :bdelete<CR>
    return
  endif
  " stats line
  let l:total = 0
  let l:parts = []
  for [l:prefix, l:entries] in l:sorted
    let l:total += len(l:entries)
    call add(l:parts, l:prefix . ': ' . len(l:entries))
  endfor
  call append(0, 'Tags (' . l:total . ' total) | ' . join(l:parts, ' | '))
  call append(1, repeat('-', 50))
  for [l:prefix, l:entries] in l:sorted
    call append('$', l:prefix . ' (' . len(l:entries) . '):')
    for l:item in l:entries
      call append('$', '  ' . l:item.lnum . ': ' . l:item.text)
    endfor
    call append('$', '')
  endfor
  " highlight each prefix with its scheme color
  for [l:prefix, l:entries] in l:sorted
    let l:color = s:GetColor(l:prefix)
    execute 'highlight Owl' . l:prefix . ' guifg=' . l:color . ' ctermfg=Yellow'
    call matchadd('Owl' . l:prefix, '\<' . l:prefix . '\>')
  endfor
  " press Enter on a "  123: text" line to jump to that line
  nnoremap <buffer> <silent> <CR> :call <SID>JumpToTag()<CR>
  nnoremap <buffer> <silent> q :bdelete<CR>
endfunction

function! s:JumpToTag()
  let l:line = getline('.')
  let l:match = matchstr(l:line, '^\s\+\zs\d\+\ze:')
  if !empty(l:match)
    let l:target = str2nr(l:match)
    bdelete
    execute l:target
  endif
endfunction

function! OwlHighlight()
  let l:all_tags = s:AllTags()
  for l:tag in l:all_tags
    let l:color = s:GetColor(l:tag)
    execute 'highlight Owl' . l:tag . ' guifg=' . l:color . ' ctermfg=Yellow'
    call matchadd('Owl' . l:tag, '\<' . l:tag . '\>')
  endfor
endfunction

command! OwlScan call GetTaggedLines()
command! OwlHighlight call OwlHighlight()
