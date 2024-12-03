// ioBroker eslint template configuration file for js and ts files
// Please note that esm or react based modules need additional modules loaded.
import config from '@iobroker/eslint-config';

export default [
    ...config,

    {
        // specify files to exclude from linting here
        ignores: [
            'src-admin/**/*',
            'src/**/*',
            'admin/**/*',
            'node_modules/**/*',
            'test/**/*',
            'build/**/*',
            'tasks.js',
            'tmp/**/*',
            '.**/*',
            '.dev-server/',
            '.vscode/',
            '*.test.js',
            'test/**/*.js',
            '*.config.mjs',
            'build',
            'admin/build',
            'admin/words.js',
            'admin/admin.d.ts',
            '**/adapter-config.d.ts',    
        ] 
    },

    {
        // you may disable some 'jsdoc' warnings - but using jsdoc is highly recommended
        // as this improves maintainability. jsdoc warnings will not block buiuld process.
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'no-async-promise-executor': 'off',
            'prettier/prettier': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-prototype-builtins': 'off',
            'curly': 'off',
            'jsdoc/require-returns-description': 'off',
            'no-else-return': 'off',
            'no-case-declarations': 'off',
            'no-useless-escape': 'off',
            //'jsdoc/require-param': 'off',
            //'@typescript-eslint/ban-ts-comment': 'off',
            //'@typescript-eslint/no-require-imports': 'off',
            //'jsdoc/no-types': 'off',
            //'jsdoc/tag-lines': 'off',
        },
    },
];
