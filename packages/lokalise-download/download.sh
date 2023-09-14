set -ex

echo " Going to start lokalise download with the folloeing args:\n
        project-id -> $2
        unzip-to -> $3 
        format -> $4
        bundle-structure -> $5
        placeholder-format -> $6
        triggers -> $7
        add-newline-eof -> $8
        filter-repositories -> $9 
        filter-filenames -> ${10}
        plural-format -> ${11}
        indentation -> ${12}
        export-sort -> ${13}
        original-filenames -> ${14}
        directory-prefix -> ${15}
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
    --add-newline-eof $8 \
    --filter-repositories $9 \
    --filter-filenames ${10} \
    --plural-format ${11} \
    --indentation ${12} \
    --export-sort ${13} \
    --original-filenames ${14} \
    --directory-prefix ${15}
