# :punch: `jest-coverage`

Checks coverage of your jest tests results and fails if it is below the threshold. 
Instead of `nyc` command that can check only global coverage, this action can check coverage for different paths separately.

Like Jest, `global` only counts files not matched by any other `coverageThreshold` key; directory/file keys are checked in aggregate and glob keys per matching file.
