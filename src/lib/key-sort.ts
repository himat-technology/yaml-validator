import {
  Alias,
  isAlias,
  isCollection,
  isDocument,
  isNode,
  isPair,
  isScalar,
  visit,
  type Document,
  type Node,
  type Pair,
} from "yaml";

const MERGE_KEY = "<<";

/**
 * Case-insensitive alphabetical order with a deterministic case-sensitive
 * tie-break. YAML merge keys (`<<`) always stay first so that explicit keys
 * keep overriding merged ones.
 */
export function compareKeys(a: string, b: string): number {
  if (a === b) return 0;
  if (a === MERGE_KEY) return -1;
  if (b === MERGE_KEY) return 1;
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA !== lowerB) return lowerA < lowerB ? -1 : 1;
  return a < b ? -1 : 1;
}

function defineKey(target: Record<string, unknown>, key: string, value: unknown) {
  // defineProperty keeps keys such as "__proto__" as ordinary own properties.
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/**
 * Returns a copy of a JSON-like value with object keys sorted recursively.
 * Array element order is never changed.
 */
export function sortKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item)) as T;
  }
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort(compareKeys)) {
      defineKey(sorted, key, sortKeysDeep(source[key]));
    }
    return sorted as T;
  }
  return value;
}

function pairKeyText(pair: Pair): string {
  const key = pair.key;
  if (key === null || key === undefined) return "";
  if (isScalar(key)) return String(key.value);
  return String(key);
}

type VisitKey = number | "key" | "value" | null;

interface AnchoredNode {
  node: Node;
  parent: unknown;
  key: VisitKey;
  redefined: boolean;
}

function replaceChild(parent: unknown, key: VisitKey, node: Node): void {
  if (isPair(parent)) {
    if (key === "key") parent.key = node;
    else parent.value = node;
  } else if (isDocument(parent)) {
    parent.contents = node;
  } else if (isCollection(parent) && typeof key === "number") {
    parent.items[key] = node;
  }
}

/**
 * After reordering, an alias can end up before the node that defines its
 * anchor, which is invalid YAML. This moves each such definition to the first
 * place it is used and puts an alias where it used to be, so the document
 * still describes exactly the same data.
 */
export function hoistAnchorsBeforeAliases(doc: Document): void {
  const anchored = new Map<string, AnchoredNode>();
  visit(doc, (key, node, path) => {
    if (isNode(node) && !isAlias(node) && node.anchor) {
      const redefined = anchored.has(node.anchor);
      anchored.set(node.anchor, { node, parent: path[path.length - 1], key: key as VisitKey, redefined });
    }
  });
  if (anchored.size === 0) return;

  const defined = new Set<string>();
  visit(doc, (_key, node, path) => {
    if (isAlias(node)) {
      if (defined.has(node.source)) return;
      const target = anchored.get(node.source);
      // Redefined anchor names make "which definition" order-dependent, so they are left alone.
      if (!target || target.redefined || path.includes(target.node)) return;
      replaceChild(target.parent, target.key, new Alias(node.source));
      // Returning the node puts it here; visit() then continues into it.
      return target.node;
    }
    if (isNode(node) && node.anchor) defined.add(node.anchor);
  });
}

/**
 * Sorts every mapping in a parsed YAML document in place, keeping comments with
 * their pairs. Blank lines are stored on the key that follows them, so after
 * sorting they are re-applied uniformly: if the mapping separated its entries
 * with blank lines, every entry but the first gets one.
 */
export function sortYamlDocumentKeys(doc: Document): void {
  visit(doc, {
    Map(_, map) {
      const keys = map.items.map((pair) => (isNode(pair.key) ? pair.key : null));
      const separated = keys.slice(1).some((key) => key?.spaceBefore);
      map.items.sort((a, b) => compareKeys(pairKeyText(a), pairKeyText(b)));
      map.items.forEach((pair, index) => {
        if (isNode(pair.key)) pair.key.spaceBefore = index > 0 && separated ? true : undefined;
      });
    },
  });
  hoistAnchorsBeforeAliases(doc);
}
