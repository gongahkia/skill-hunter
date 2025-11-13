" Supported tag prefixes that Owl will search for in the buffer
let g:tags = ['TODO', 'FIXME', 'TEMP', 'REF', 'REV']

" Scans the current buffer for lines containing supported tag prefixes.
" Extracts and organizes tagged content by tag type, then displays results.
" Tags are matched case-insensitively using word boundaries.
function! GetTaggedLines()
    let l:lines = getline(1, '$')
    let l:tags = {}
    for l:line in l:lines
        for l:tag in g:tags
            if l:line =~? '\<' . l:tag . '\>'
                let l:sanitised_line = substitute(l:line, '.*\<' . l:tag . '\>\s*', '', '')
                if !empty(l:sanitised_line)
                    if !has_key(l:tags, l:tag)
                        let l:tags[l:tag] = []
                    endif
                    call add(l:tags[l:tag], l:sanitised_line)
                endif
            endif
        endfor
    endfor
    call DisplayTags(l:tags)
endfunction

" Displays tagged lines in a new scratch buffer.
" Creates a non-file buffer that shows all found tags organized by prefix.
" If no tags are found, displays an informative message.
" @param tags Dictionary mapping tag prefixes to arrays of tagged content
function! DisplayTags(tags)
    enew
    setlocal buftype=nofile bufhidden=wipe noswapfile nowrap
    call append(0, '📍 Tags')
    if empty(a:tags)
        call append(2, 'Owl found no tagged lines. 😭')
        nnoremap <buffer> <silent> :q<CR> :b 1<CR>
        return
    endif
    for [l:prefix, l:lines] in items(a:tags)
        call append('$', l:prefix . ':')
        for l:item in l:lines
            call append('$', '- ' . l:item)
        endfor
        call append('$', '')
    endfor
    highlight TagHighlight ctermfg=yellow guifg=yellow
    nnoremap <buffer> <silent> :q<CR> :b 1<CR>
endfunction

" User command to trigger tag scanning in the current buffer
command! OwlScan call GetTaggedLines()
