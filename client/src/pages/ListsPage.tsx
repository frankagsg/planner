import { useCallback, useEffect, useState } from 'react';
import { Plus, Check, Trash2, Eraser, ListPlus } from 'lucide-react';
import { api } from '../lib/api';
import { useFeedback } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Field } from '../components/ui/Field';
import { MemberDot } from '../components/MemberBadge';
import { useFamily } from '../hooks/useFamily';
import type { ShoppingList, ShoppingItem } from '../types';

export default function ListsPage() {
  const { toast, confirm } = useFeedback();
  const { byId } = useFamily();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newText, setNewText] = useState('');
  const [newList, setNewList] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    try {
      const ls = await api.get<ShoppingList[]>('/shopping/lists', true);
      setLists(ls);
      setActiveId((cur) => (cur && ls.some((l) => l.id === cur) ? cur : ls[0]?.id ?? null));
    } catch {
      toast('Could not load lists', 'error');
    }
  }, [toast]);

  const loadItems = useCallback(async () => {
    if (!activeId) {
      setItems([]);
      return;
    }
    try {
      setItems(await api.get<ShoppingItem[]>(`/shopping/items?list_id=${activeId}`, true));
    } catch {
      /* offline: keep */
    }
  }, [activeId]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const add = async () => {
    const text = newText.trim();
    if (!text || !activeId) return;
    setNewText('');
    try {
      await api.post('/shopping/items', { list_id: activeId, text });
      loadItems();
      loadLists();
    } catch {
      toast('Could not add', 'error');
    }
  };

  const toggle = async (item: ShoppingItem) => {
    // Optimistic flip for snappy feel.
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: i.checked ? 0 : 1 } : i))
    );
    try {
      await api.post(`/shopping/items/${item.id}/toggle`);
      loadLists();
    } catch {
      loadItems();
    }
  };

  const removeItem = async (item: ShoppingItem) => {
    await api.del(`/shopping/items/${item.id}`);
    loadItems();
    loadLists();
  };

  const clearChecked = async () => {
    if (!activeId) return;
    const r = await api.post<{ cleared: number }>(`/shopping/lists/${activeId}/clear-checked`);
    toast(r.cleared ? `Cleared ${r.cleared} item${r.cleared === 1 ? '' : 's'}` : 'Nothing to clear', 'info');
    loadItems();
    loadLists();
  };

  const createList = async () => {
    const name = (newList || '').trim();
    if (!name) return;
    const l = await api.post<ShoppingList>('/shopping/lists', { name });
    setNewList(null);
    await loadLists();
    setActiveId(l.id);
  };

  const deleteList = async () => {
    if (!activeId) return;
    const list = lists.find((l) => l.id === activeId);
    const ok = await confirm({
      title: 'Delete list?',
      message: `"${list?.name}" and its items will be removed.`,
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await api.del(`/shopping/lists/${activeId}`);
    setActiveId(null);
    loadLists();
  };

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold text-content">Lists</h1>
        <button className="btn-ghost" onClick={() => setNewList('')}>
          <ListPlus size={20} /> New list
        </button>
      </div>

      {/* List tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveId(l.id)}
            className={`btn !py-2.5 shrink-0 ${activeId === l.id ? 'btn-primary' : 'btn-ghost'}`}
          >
            {l.name}
            {l.total ? (
              <span className="chip bg-black/10 !py-0.5 !px-2 ml-1">
                {(l.total || 0) - (l.checked || 0)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Add item */}
      {activeId && (
        <div className="flex gap-2 mb-4">
          <input
            className="input flex-1"
            placeholder="Add an item…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn-primary" onClick={add}>
            <Plus size={22} /> Add
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-10 text-center text-content-faint text-lg">
          {activeId ? 'This list is empty. Add something above. 🧺' : 'No lists yet.'}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
            const m = byId(item.member_id);
            return (
              <li
                key={item.id}
                className={`card p-4 flex items-center gap-4 transition ${
                  item.checked ? 'opacity-60' : ''
                }`}
              >
                <button
                  onClick={() => toggle(item)}
                  className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center shrink-0 transition
                    ${
                      item.checked
                        ? 'bg-accent border-accent text-white'
                        : 'border-line text-transparent hover:border-accent'
                    }`}
                  aria-label={item.checked ? 'Uncheck' : 'Check'}
                >
                  <Check size={26} strokeWidth={3} />
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-lg font-semibold text-content ${
                      item.checked ? 'line-through' : ''
                    }`}
                  >
                    {item.text}
                    {item.qty ? <span className="text-content-faint font-normal"> · {item.qty}</span> : null}
                  </div>
                </div>
                {m && <MemberDot color={m.color} />}
                <button
                  className="text-content-faint hover:text-rose-500 p-2"
                  onClick={() => removeItem(item)}
                  aria-label="Remove"
                >
                  <Trash2 size={20} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {activeId && (
        <div className="flex gap-2 mt-5 flex-wrap">
          <button className="btn-ghost" onClick={clearChecked} disabled={!checkedCount}>
            <Eraser size={20} /> Clear checked ({checkedCount})
          </button>
          <button className="btn-ghost text-rose-500 ml-auto" onClick={deleteList}>
            <Trash2 size={20} /> Delete list
          </button>
        </div>
      )}

      <Modal
        open={newList !== null}
        onClose={() => setNewList(null)}
        title="New list"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setNewList(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={createList}>
              Create
            </button>
          </>
        }
      >
        <Field label="List name">
          <input
            className="input"
            autoFocus
            value={newList || ''}
            onChange={(e) => setNewList(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createList()}
          />
        </Field>
      </Modal>
    </div>
  );
}
