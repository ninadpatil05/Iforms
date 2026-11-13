from collections import defaultdict, deque
from typing import Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.branch_rule import SectionBranchRule
from app.models.section import Section


def has_path(edges: List[Tuple[int, int]], start_id: int, target_id: int) -> bool:
    """Return True if target_id is reachable from start_id using directed edges."""
    if start_id == target_id:
        return True

    adj: dict[int, list[int]] = defaultdict(list)
    for u, v in edges:
        adj[u].append(v)

    visited: set[int] = set()
    queue = deque([start_id])

    while queue:
        curr = queue.popleft()
        if curr == target_id:
            return True
        if curr in visited:
            continue
        visited.add(curr)
        for nxt in adj[curr]:
            if nxt not in visited:
                queue.append(nxt)

    return False


def find_cycle_path(
    edges: List[Tuple[int, int]], start_id: int, target_id: int
) -> Optional[List[int]]:
    """Return the shortest path from start_id to target_id (inclusive), or None if unreachable.

    Used to generate descriptive cycle error messages: the caller can
    translate node IDs to section titles and render e.g. "Intro → Review → Intro".
    """
    if start_id == target_id:
        return [start_id]

    adj: dict[int, list[int]] = defaultdict(list)
    for u, v in edges:
        adj[u].append(v)

    # BFS tracking parent pointers
    parent: dict[int, int] = {}
    queue = deque([start_id])

    while queue:
        curr = queue.popleft()
        for nxt in adj[curr]:
            if nxt in parent or nxt == start_id:
                continue
            parent[nxt] = curr
            if nxt == target_id:
                # Reconstruct path
                path = [target_id]
                node = target_id
                while node != start_id:
                    node = parent[node]
                    path.append(node)
                path.reverse()
                return path
            queue.append(nxt)

    return None


def get_section_title_map(db: Session, form_version_id: int) -> Dict[int, str]:
    """Return a mapping {section_id: title} for all sections in a form version."""
    sections = db.execute(
        select(Section).where(Section.form_version_id == form_version_id)
    ).scalars().all()
    return {s.id: s.title for s in sections}


def _build_edges_for_version(
    db: Session,
    from_section_id: int,
    ignore_rule_id: Optional[int],
    is_updating_default_next: bool,
) -> Tuple[List[Tuple[int, int]], Optional[int]]:
    """Return (edges, form_version_id) for the given from_section, or ([], None) if not found."""
    from_section = db.execute(
        select(Section).where(Section.id == from_section_id)
    ).scalar_one_or_none()
    if not from_section:
        return [], None

    form_version_id = from_section.form_version_id

    sections = db.execute(
        select(Section).where(Section.form_version_id == form_version_id)
    ).scalars().all()
    section_ids = {s.id for s in sections}

    rules = db.execute(
        select(SectionBranchRule).where(
            SectionBranchRule.from_section_id.in_(section_ids)
        )
    ).scalars().all()

    edges: List[Tuple[int, int]] = []
    for rule in rules:
        if ignore_rule_id is not None and rule.id == ignore_rule_id:
            continue
        if rule.to_section_id is not None:
            edges.append((rule.from_section_id, rule.to_section_id))

    for sec in sections:
        if is_updating_default_next and sec.id == from_section_id:
            continue
        if sec.default_next_section_id is not None:
            edges.append((sec.id, sec.default_next_section_id))

    return edges, form_version_id


def would_create_cycle(
    db: Session,
    from_section_id: int,
    proposed_to_section_id: int,
    ignore_rule_id: Optional[int] = None,
    is_updating_default_next: bool = False,
) -> bool:
    """Check if adding an edge from_section_id -> proposed_to_section_id creates a cycle.

    Queries all existing branch rules and default_next_section_id edges for the
    form_version containing from_section_id, then checks if proposed_to_section_id
    can reach from_section_id.
    """
    edges, _ = _build_edges_for_version(
        db, from_section_id, ignore_rule_id, is_updating_default_next
    )
    if not edges and _ is None:
        return False
    return has_path(edges, proposed_to_section_id, from_section_id)


def would_create_cycle_with_path(
    db: Session,
    from_section_id: int,
    proposed_to_section_id: int,
    ignore_rule_id: Optional[int] = None,
    is_updating_default_next: bool = False,
) -> Tuple[bool, Optional[str]]:
    """Like would_create_cycle but also returns a human-readable path string on cycle detection.

    Returns (True, "Section A → Section B → Section A") when a cycle is found,
    or (False, None) when safe.
    """
    edges, form_version_id = _build_edges_for_version(
        db, from_section_id, ignore_rule_id, is_updating_default_next
    )
    if form_version_id is None:
        return False, None

    if not has_path(edges, proposed_to_section_id, from_section_id):
        return False, None

    # Build descriptive path: proposed_to → ... → from → (back to proposed_to)
    title_map = get_section_title_map(db, form_version_id)
    path_ids = find_cycle_path(edges, proposed_to_section_id, from_section_id)
    if path_ids is not None:
        # Append the start node to show the loop closing
        path_ids = path_ids + [proposed_to_section_id]
        path_str = " → ".join(title_map.get(sid, f"Section {sid}") for sid in path_ids)
    else:
        path_str = f"{title_map.get(proposed_to_section_id, proposed_to_section_id)} → ... → {title_map.get(from_section_id, from_section_id)}"

    return True, path_str

