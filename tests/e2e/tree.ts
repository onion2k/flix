// What of a part of the page is in the browser's own accessibility tree, as a
// screen reader is given it: each node's role and name, for the nodes the
// browser has not left out. It asks Chromium over its DevTools protocol and not
// Playwright's own reading of roles, since Playwright counts an element under
// `inert` as there (it reads the markup's roles, and inert takes nothing from
// the markup), where the browser leaves it out of the tree. Without it a face
// of a card that is turned away, and meant to be out of the tree, would read
// to a spec as if it were in it, and one that was left in would pass.
import type { Locator } from '@playwright/test';

interface AxNode {
  ignored: boolean;
  role?: { value?: string };
  name?: { value?: string };
}

/**
 * The nodes of the tree under `locator` (one element) that the browser gives a
 * screen reader, as "role: name", leaving out the line boxes that only split
 * a text into lines and anything with no name. Chromium alone, as the e2e
 * project is.
 */
export async function inTree(locator: Locator): Promise<string[]> {
  const page = locator.page();
  const session = await page.context().newCDPSession(page);
  try {
    // The element is found by a mark put on it for the moment, since the
    // protocol knows nothing of a Playwright locator; an attribute of no
    // meaning changes nothing in the tree.
    await locator.evaluate((el) => el.setAttribute('data-tree-probe', ''));
    const { root } = await session.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await session.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: '[data-tree-probe]',
    });
    const { node } = await session.send('DOM.describeNode', { nodeId });
    const { nodes } = (await session.send('Accessibility.queryAXTree', {
      backendNodeId: node.backendNodeId,
    })) as { nodes: AxNode[] };
    return nodes
      .filter((each) => !each.ignored)
      .map((each) => ({
        role: each.role?.value ?? '',
        name: (each.name?.value ?? '').trim(),
      }))
      .filter((each) => each.name !== '' && each.role !== 'InlineTextBox')
      .map((each) => `${each.role}: ${each.name}`);
  } finally {
    await locator
      .evaluate((el) => el.removeAttribute('data-tree-probe'))
      .catch(() => undefined);
    await session.detach();
  }
}
