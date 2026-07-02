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
      (currentNode.type === 'CallExpression' &&
        currentNode.callee?.type === 'Identifier' &&
        ['setInterval', 'setTimeout'].includes(currentNode.callee.name)) ||
      (currentNode.type === 'CallExpression' &&
        currentNode.callee?.type === 'MemberExpression' &&
        currentNode.callee.property?.type === 'Identifier' &&
        ['setInterval', 'setTimeout'].includes(
          currentNode.callee.property.name,
        )),
  );
}

function hasCleanupReturn(statements) {
  return statements.some(
    (statement) =>
      statement.type === 'ReturnStatement' &&
      ['ArrowFunctionExpression', 'FunctionExpression'].includes(
        statement.argument?.type,
      ),
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

        if (
          (containsListenerRegistration(callback.body) ||
            containsTimerRegistration(callback.body)) &&
          !hasCleanupReturn(statements)
        ) {
          context.report({
            node,
            messageId: 'missingCleanup',
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

export default {
  rules: {
    'no-direct-imported-component-reference-in-render':
      noDirectImportedComponentReferenceInRender,
    'no-empty-hook-callback': noEmptyHookCallback,
    'require-use-effect-listener-cleanup': requireUseEffectListenerCleanup,
  },
};
