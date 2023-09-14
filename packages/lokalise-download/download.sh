set -ex

echo " Going to start lokalise download with the folloeing args:\n
        project-id -> $2
        unzip-to -> $3 
        format -> $4
        bundle-structure -> $5
        placeholder-format -> $6
        triggers -> $7
        add_newline_eof -> $8
        filter_repositories -> $9 
        filter_filenames -> ${10}
        plural_format -> ${11}
        indentation -> ${12}
        export_sort -> ${13}
        original-filenames -> ${14}  
     "

lokalise2 \
    --token $1 \
    --project-id $2 \
    file download \
    --format $4 \
    --unzip-to $3 \
    --bundle-structure $5 \
    --placeholder-format $6 \
    --triggers $7 \
    --add_newline_eof $8 \
    --filter_repositories $9 \
    --filter_filenames ${10} \
    --plural_format ${11} \
    --indentation ${12} \
    --export_sort ${13} \
    --original-filenames ${14}
