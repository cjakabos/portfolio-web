"""Find exact test declarations in Python, Java and TypeScript syntax trees.

This is source validation, not proof of runner collection or execution.
"""

from __future__ import annotations
import ast
from pathlib import Path
from tree_sitter import Language, Parser
import tree_sitter_java
import tree_sitter_typescript


def walk(node):
    yield node
    for child in node.named_children:
        yield from walk(child)


def declarations(path: Path) -> set[str]:
    content = path.read_bytes()
    if path.suffix == ".py":
        tree = ast.parse(content, filename=str(path))
        result = set()
        for node in tree.body:
            if isinstance(
                node, (ast.FunctionDef, ast.AsyncFunctionDef)
            ) and node.name.startswith("test_"):
                result.add(node.name)
            elif isinstance(node, ast.ClassDef) and (
                node.name.startswith("Test")
                or any(
                    isinstance(base, ast.Attribute)
                    and base.attr == "TestCase"
                    or isinstance(base, ast.Name)
                    and base.id == "TestCase"
                    for base in node.bases
                )
            ):
                for method in node.body:
                    if isinstance(
                        method, (ast.FunctionDef, ast.AsyncFunctionDef)
                    ) and method.name.startswith("test_"):
                        result.add(f"{node.name}.{method.name}")
        return result
    if path.suffix == ".java":
        language = Language(tree_sitter_java.language())
    elif path.suffix in {".ts", ".tsx"}:
        language = Language(
            tree_sitter_typescript.language_tsx()
            if path.suffix == ".tsx"
            else tree_sitter_typescript.language_typescript()
        )
    else:
        raise ValueError(f"unsupported test source: {path}")
    tree = Parser(language).parse(content)
    if tree.root_node.has_error:
        raise ValueError(f"cannot parse test source: {path}")
    result = set()
    for node in walk(tree.root_node):
        if path.suffix == ".java" and node.type == "method_declaration":
            modifiers = next(
                (child for child in node.children if child.type == "modifiers"), None
            )
            if modifiers is None or not any(
                child.type in {"annotation", "marker_annotation"}
                and child.text.decode().split("(")[0] in {"@Test", "@ParameterizedTest"}
                for child in modifiers.named_children
            ):
                continue
            parent = node.parent
            classes = []
            while parent:
                if parent.type == "class_declaration":
                    classes.insert(0, parent.child_by_field_name("name").text.decode())
                parent = parent.parent
            result.add(
                ".".join(classes + [node.child_by_field_name("name").text.decode()])
            )
        elif path.suffix in {".ts", ".tsx"} and node.type == "call_expression":
            function = node.child_by_field_name("function")
            args = node.child_by_field_name("arguments")
            if (
                function is None
                or args is None
                or function.text.decode()
                not in {"test", "it", "test.only", "it.only", "test.skip", "it.skip"}
            ):
                continue
            if not args.named_children or args.named_children[0].type != "string":
                continue
            title = ast.literal_eval(args.named_children[0].text.decode())
            if title in result:
                raise ValueError(f"ambiguous duplicate test title in {path}: {title}")
            result.add(title)
    return result


SUITE_ROOTS = {
    "test-requirements": "tests/requirement-cases/",
    "test-ai-orchestration-layer": "tests/ai-orchestration-layer/",
    "test-ml-pipeline": "tests/ml-pipeline/",
    "test-backend": "backend/cloudapp/src/test/",
    "test-backend-petstore": "backend/petstore/src/test/",
    "test-backend-vehicles": "backend/vehicles-api/src/test/",
    "test-backend-webproxy": "backend/web-proxy/src/test/",
}


def runner_identity(path, test_id, suite, root):
    """Resolve the native identity from the governed source namespace."""
    source = root / path
    if source.suffix == ".java":
        tree = Parser(Language(tree_sitter_java.language())).parse(source.read_bytes())
        package = next((node for node in tree.root_node.named_children if node.type == "package_declaration"), None)
        names = ([node for node in package.named_children if node.type in {"identifier", "scoped_identifier"}]
                 if package else [])
        prefix = names[-1].text.decode() + "." if names else ""
        return prefix + test_id
    if source.suffix == ".py":
        relative = Path(path).relative_to(SUITE_ROOTS[suite])
        module = ".".join(relative.with_suffix("").parts)
        return module + "." + test_id
    return None
