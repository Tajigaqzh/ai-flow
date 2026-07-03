function isUseEffectCall(node) {
  return node.callee?.type === 'Identifier' && node.callee.name === 'useEffect';
}

function isHookCall(node, hookNames) {
  return (
    node.callee?.type === 'Identifier' && hookNames.includes(node.callee.name)
  );
}

function getEffectCallback(node) {
  return node.arguments?.[0];
}

function getFunctionBodyStatements(node) {
  if (!node || node.body?.type !== 'BlockStatement') {
    return [];
  }

  return node.body.body;
}

function getCalleePropertyName(node) {
  if (node?.callee?.type === 'Identifier') {
    return node.callee.name;
  }

  if (
    node?.callee?.type === 'MemberExpression' &&
    node.callee.property?.type === 'Identifier'
  ) {
    return node.callee.property.name;
  }

  return null;
}

function hasNodeMatching(node, predicate, seen = new WeakSet()) {
  if (!node || typeof node !== 'object') {
    return false;
  }

  if (seen.has(node)) {
    return false;
  }

  seen.add(node);

  if (predicate(node)) {
    return true;
  }

  for (const [key, value] of Object.entries(node)) {
    if (['parent', 'loc', 'range', 'tokens', 'comments'].includes(key)) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.some((item) => hasNodeMatching(item, predicate, seen))) {
        return true;
      }
    } else if (value && typeof value === 'object') {
      if (hasNodeMatching(value, predicate, seen)) {
        return true;
      }
    }
  }

  return false;
}

function containsListenerRegistration(node) {
  return hasNodeMatching(
    node,
    (currentNode) =>
      (currentNode.type === 'CallExpression' &&
        currentNode.callee?.type === 'MemberExpression' &&
        currentNode.callee.property?.type === 'Identifier' &&
        currentNode.callee.property.name === 'addEventListener') ||
      (currentNode.type === 'AssignmentExpression' &&
        currentNode.left?.type === 'MemberExpression' &&
        currentNode.left.property?.type === 'Identifier' &&
        /^on[A-Z_a-z]/.test(currentNode.left.property.name)),
  );
}

function containsTimerRegistration(node) {
  return hasNodeMatching(
    node,
    (currentNode) =>
      currentNode.type === 'CallExpression' &&
      ['setInterval', 'setTimeout'].includes(
        getCalleePropertyName(currentNode),
      ),
  );
}

function getCleanupReturn(statements) {
  return statements.find(
    (statement) =>
      statement.type === 'ReturnStatement' &&
      ['ArrowFunctionExpression', 'FunctionExpression'].includes(
        statement.argument?.type,
      ),
  );
}

function containsTimerCleanup(node) {
  return hasNodeMatching(
    node,
    (currentNode) =>
      currentNode.type === 'CallExpression' &&
      ['clearInterval', 'clearTimeout'].includes(
        getCalleePropertyName(currentNode),
      ),
  );
}

function containsEchartsInit(node) {
  return hasNodeMatching(
    node,
    (currentNode) =>
      currentNode.type === 'CallExpression' &&
      currentNode.callee?.type === 'MemberExpression' &&
      currentNode.callee.object?.type === 'Identifier' &&
      currentNode.callee.object.name === 'echarts' &&
      currentNode.callee.property?.type === 'Identifier' &&
      currentNode.callee.property.name === 'init',
  );
}

function containsEchartsDispose(node) {
  return hasNodeMatching(
    node,
    (currentNode) =>
      currentNode.type === 'CallExpression' &&
      currentNode.callee?.type === 'MemberExpression' &&
      currentNode.callee.property?.type === 'Identifier' &&
      currentNode.callee.property.name === 'dispose',
  );
}

const requireUseEffectListenerCleanup = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'require cleanup return when useEffect registers event listeners or timers',
    },
    messages: {
      missingCleanup:
        'useEffect registers an event listener or timer and must return a cleanup function.',
      missingTimerCleanup:
        'useEffect registers a timer and cleanup must call clearInterval or clearTimeout.',
      missingEchartsDispose:
        'useEffect initializes an ECharts instance and cleanup must dispose it.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isUseEffectCall(node)) {
          return;
        }

        const callback = getEffectCallback(node);
        const statements = getFunctionBodyStatements(callback);

        if (statements.length === 0) {
          return;
        }

        const hasListenerRegistration = containsListenerRegistration(
          callback.body,
        );
        const hasTimerRegistration = containsTimerRegistration(callback.body);
        const hasChartInit = containsEchartsInit(callback.body);
        const cleanupReturn = getCleanupReturn(statements);

        if (
          (hasListenerRegistration || hasTimerRegistration || hasChartInit) &&
          !cleanupReturn
        ) {
          context.report({
            node,
            messageId: 'missingCleanup',
          });
          return;
        }

        if (hasTimerRegistration && !containsTimerCleanup(cleanupReturn)) {
          context.report({
            node,
            messageId: 'missingTimerCleanup',
          });
        }

        if (hasChartInit && !containsEchartsDispose(cleanupReturn)) {
          context.report({
            node,
            messageId: 'missingEchartsDispose',
          });
        }
      },
    };
  },
};

const noEmptyHookCallback = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow empty useEffect, useCallback, and useMemo callbacks',
    },
    messages: {
      emptyHook:
        'Empty {{hookName}} callbacks are not allowed. Remove it or implement the hook logic.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isHookCall(node, ['useEffect', 'useCallback', 'useMemo'])) {
          return;
        }

        const callback = getEffectCallback(node);
        const statements = getFunctionBodyStatements(callback);

        if (
          ['ArrowFunctionExpression', 'FunctionExpression'].includes(
            callback?.type,
          ) &&
          statements.length === 0
        ) {
          context.report({
            node,
            messageId: 'emptyHook',
            data: {
              hookName: node.callee.name,
            },
          });
        }
      },
    };
  },
};

function isPascalCaseName(name) {
  return /^[A-Z]/.test(name);
}

function getFunctionComponentName(node) {
  if (node.type === 'FunctionDeclaration') {
    return node.id?.name;
  }

  const parent = node.parent;

  if (
    ['ArrowFunctionExpression', 'FunctionExpression'].includes(node.type) &&
    parent?.type === 'VariableDeclarator' &&
    parent.id?.type === 'Identifier'
  ) {
    return parent.id.name;
  }

  return null;
}

const noDirectImportedComponentReferenceInRender = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow returning imported component identifiers directly from render output',
    },
    messages: {
      directComponent:
        'Imported component {{componentName}} must be rendered as JSX, for example <{{componentName}} />.',
    },
    schema: [],
  },
  create(context) {
    const importedComponentNames = new Set();

    function reportDirectComponentReference(node) {
      if (!node) {
        return;
      }

      if (node.type === 'Identifier' && importedComponentNames.has(node.name)) {
        context.report({
          node,
          messageId: 'directComponent',
          data: {
            componentName: node.name,
          },
        });

        return;
      }

      if (node.type === 'ConditionalExpression') {
        reportDirectComponentReference(node.consequent);
        reportDirectComponentReference(node.alternate);
        return;
      }

      if (node.type === 'LogicalExpression') {
        reportDirectComponentReference(node.right);
      }
    }

    return {
      ImportDeclaration(node) {
        for (const specifier of node.specifiers) {
          const localName = specifier.local?.name;

          if (
            localName &&
            localName !== 'React' &&
            isPascalCaseName(localName)
          ) {
            importedComponentNames.add(localName);
          }
        }
      },
      ReturnStatement(node) {
        if (node.argument) {
          reportDirectComponentReference(node.argument);
        }
      },
      ArrowFunctionExpression(node) {
        if (node.expression) {
          reportDirectComponentReference(node.body);
        }
      },
    };
  },
};

const noNestedComponentDefinition = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow defining child components inside components',
    },
    messages: {
      nestedComponent:
        'Do not define component {{componentName}} inside another component; move it to module scope.',
    },
    schema: [],
  },
  create(context) {
    const componentStack = [];

    function enterFunction(node) {
      const componentName = getFunctionComponentName(node);
      const isComponent = componentName && isPascalCaseName(componentName);

      if (isComponent && componentStack.length > 0) {
        context.report({
          node,
          messageId: 'nestedComponent',
          data: {
            componentName,
          },
        });
      }

      componentStack.push(isComponent);
    }

    function exitFunction() {
      componentStack.pop();
    }

    return {
      ArrowFunctionExpression: enterFunction,
      'ArrowFunctionExpression:exit': exitFunction,
      FunctionDeclaration: enterFunction,
      'FunctionDeclaration:exit': exitFunction,
      FunctionExpression: enterFunction,
      'FunctionExpression:exit': exitFunction,
    };
  },
};

const noUnstableJsxKeyExpression = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow JSX key expressions that mutate values',
    },
    messages: {
      unstableKey:
        'Do not mutate values inside JSX key; use a stable business id.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (
          node.name?.name !== 'key' ||
          node.value?.type !== 'JSXExpressionContainer'
        ) {
          return;
        }

        const expression = node.value.expression;

        if (
          expression?.type === 'UpdateExpression' ||
          expression?.type === 'AssignmentExpression'
        ) {
          context.report({
            node,
            messageId: 'unstableKey',
          });
        }
      },
    };
  },
};

export default {
  rules: {
    'no-nested-component-definition': noNestedComponentDefinition,
    'no-direct-imported-component-reference-in-render':
      noDirectImportedComponentReferenceInRender,
    'no-empty-hook-callback': noEmptyHookCallback,
    'no-unstable-jsx-key-expression': noUnstableJsxKeyExpression,
    'require-use-effect-listener-cleanup': requireUseEffectListenerCleanup,
  },
};
