let g:tags = ['TODO', 'FIXME', 'TEMP', 'REF', 'REV']

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

function! DisplayTags(tags)
    enew
    setlocal buftype=nofile bufhidden=wipe noswapfile nowrap
    call append(0, '📍 Tags')
    if empty(a:tags)
        call append(2, 'Owl found no tagged lines. 😭')
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

command! OwlScan call GetTaggedLines()
