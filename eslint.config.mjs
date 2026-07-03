import nx from '@nx/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import localRules from './eslint-local-rules.mjs';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      local: localRules,
      'react-local': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['@/**', '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'VariableDeclarator[id.name=/^[a-h]$/]',
          message:
            'Do not use single-letter variable names from a to h. Use a descriptive name.',
        },
        {
          selector: 'FunctionDeclaration[id.name=/^[a-h]$/]',
          message:
            'Do not use single-letter function names from a to h. Use a descriptive name.',
        },
        {
          selector: 'ClassDeclaration[id.name=/^[a-h]$/]',
          message:
            'Do not use single-letter class names from a to h. Use a descriptive name.',
        },
        {
          selector:
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > Identifier.params[name=/^[a-h]$/]',
          message:
            'Do not use single-letter parameter names from a to h. Use a descriptive name.',
        },
        {
          selector: 'ImportSpecifier[local.name=/^[a-h]$/]',
          message:
            'Do not alias imports to single-letter names from a to h. Use a descriptive name.',
        },
        {
          selector: 'Property[key.name=/^[a-h]$/]',
          message:
            'Do not use single-letter property names from a to h. Use a descriptive name.',
        },
        {
          selector: 'PropertyDefinition[key.name=/^[a-h]$/]',
          message:
            'Do not use single-letter class property names from a to h. Use a descriptive name.',
        },
        {
          selector: 'MethodDefinition[key.name=/^[a-h]$/]',
          message:
            'Do not use single-letter method names from a to h. Use a descriptive name.',
        },
        {
          selector: 'TSPropertySignature[key.name=/^[a-h]$/]',
          message:
            'Do not use single-letter type property names from a to h. Use a descriptive name.',
        },
        {
          selector: 'TSMethodSignature[key.name=/^[a-h]$/]',
          message:
            'Do not use single-letter type method names from a to h. Use a descriptive name.',
        },
        {
          selector: 'JSXAttribute[name.name=/^[a-h]$/]',
          message:
            'Do not use single-letter JSX prop names from a to h. Use a descriptive name.',
        },
      ],
      'local/no-direct-imported-component-reference-in-render': 'error',
      'local/no-empty-hook-callback': 'error',
      'local/no-nested-component-definition': 'error',
      'local/no-unstable-jsx-key-expression': 'error',
      'local/require-use-effect-listener-cleanup': 'error',
      // React Hooks 只能在组件或自定义 Hook 顶层调用，条件/循环/普通函数中调用会导致运行时状态错位。
      'react-hooks/rules-of-hooks': 'error',
      // useEffect/useCallback/useMemo 依赖必须完整，避免读取旧闭包。
      'react-hooks/exhaustive-deps': 'error',
      'react-local/jsx-first-prop-new-line': ['error', 'multiline'],
      'react-local/jsx-indent': ['error', 2],
      'react-local/jsx-indent-props': ['error', 2],
      'comma-dangle': ['error', 'always-multiline'],
      // 空 catch 会吞掉真实异常，必须显式处理、上报或重新抛出。
      'no-empty': ['error', { allowEmptyCatch: false }],
      // 允许开发调试时临时写，但提交前 lint/check:staged 必须拦截。
      'no-console': 'error',
      'no-debugger': 'error',
      // 禁止 == / !=，统一使用严格相等，避免隐式类型转换导致线上行为不确定。
      eqeqeq: ['error', 'always'],
      'no-multi-spaces': 'error',
      semi: ['error', 'always'],
      'space-infix-ops': 'error',
      'key-spacing': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-var': 'error',
      'no-const-assign': 'error',
      'no-empty-function': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'prefer-const': [
        'error',
        {
          destructuring: 'any',
          ignoreReadBeforeAssign: false,
        },
      ],
      semi: ['error', 'always'],
    },
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    rules: {
      'no-var': 'error',
      'no-const-assign': 'error',
      'no-empty-function': 'error',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
      'prefer-const': [
        'error',
        {
          destructuring: 'any',
          ignoreReadBeforeAssign: false,
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
