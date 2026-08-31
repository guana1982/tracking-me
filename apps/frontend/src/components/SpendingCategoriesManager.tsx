import { useState } from 'react';
import {
  useSpendingCategories,
  useCreateSpendingCategory,
  useDeleteSpendingCategory,
  useAddCategoryRule,
  useDeleteCategoryRule,
  useReclassifyExpenses,
} from '../hooks/useQueries';
import { cn } from '../lib/utils';
import type { ReclassifyResultDTO } from '@budget/shared';
import { Loader2, Plus, Trash2, X, ChevronDown, ChevronRight, RefreshCw, Tags } from 'lucide-react';

// Settings section: manage spending categories and their keyword rules.
// Keywords added here have priority over the seeded dictionary; after changing
// rules, "Riclassifica storico" re-applies them to every past expense.
export function SpendingCategoriesManager() {
  const { data: categories, isLoading } = useSpendingCategories();
  const createCategory = useCreateSpendingCategory();
  const deleteCategory = useDeleteSpendingCategory();
  const addRule = useAddCategoryRule();
  const deleteRule = useDeleteCategoryRule();
  const reclassify = useReclassifyExpenses();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6366f1');
  const [newCategoryKeywords, setNewCategoryKeywords] = useState('');
  const [reclassifyResult, setReclassifyResult] = useState<ReclassifyResultDTO | null>(null);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setNewKeyword('');
  };

  const handleAddKeyword = async (categoryId: string) => {
    const keyword = newKeyword.trim().toLowerCase();
    if (keyword.length < 2) return;
    try {
      await addRule.mutateAsync({ categoryId, keyword });
      setNewKeyword('');
    } catch (error) {
      console.error('Failed to add keyword:', error);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (
      confirm(
        `Eliminare la categoria "${name}"? Le spese già classificate torneranno in "Altro".`
      )
    ) {
      try {
        await deleteCategory.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete category:', error);
      }
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    const keywords = newCategoryKeywords
      .split(',')
      .map((keyword) => keyword.trim().toLowerCase())
      .filter((keyword) => keyword.length >= 2);
    try {
      await createCategory.mutateAsync({ name, color: newCategoryColor, keywords });
      setNewCategoryName('');
      setNewCategoryKeywords('');
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleReclassify = async () => {
    setReclassifyResult(null);
    try {
      const result = await reclassify.mutateAsync();
      setReclassifyResult(result);
    } catch (error) {
      console.error('Failed to reclassify:', error);
    }
  };

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tags className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Categorie di spesa</h2>
        </div>
        <button
          onClick={handleReclassify}
          disabled={reclassify.isPending}
          title="Riesegue la classificazione automatica su tutto lo storico (le correzioni manuali restano)"
          className="btn btn-secondary text-sm"
        >
          {reclassify.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Riclassifica storico
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Ogni spesa viene classificata automaticamente dalla descrizione tramite queste parole
        chiave. Le parole chiave che aggiungi tu hanno la precedenza su quelle predefinite; dopo
        una modifica usa "Riclassifica storico" per applicarla ai mesi passati.
      </p>

      {reclassifyResult && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
          Riclassificazione completata: {reclassifyResult.classified} spese classificate,{' '}
          {reclassifyResult.unclassified} in "Altro", {reclassifyResult.skippedManual} correzioni
          manuali mantenute.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="divide-y divide-slate-100 mb-6">
          {(categories ?? []).map((category) => {
            const isExpanded = expandedId === category.id;
            return (
              <div key={category.id} className="py-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(category.id)}
                    className="flex flex-1 items-center gap-2 text-left min-w-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="font-medium text-slate-800 truncate">{category.name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {category.rules.length} parole chiave
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id, category.name)}
                    disabled={deleteCategory.isPending}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                    title="Elimina categoria"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-2 ml-6 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {category.rules.map((rule) => (
                        <span
                          key={rule.id}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                            rule.priority === 0
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-600'
                          )}
                          title={
                            rule.priority === 0
                              ? 'Parola chiave personale (vince sul dizionario predefinito)'
                              : 'Parola chiave del dizionario predefinito'
                          }
                        >
                          {rule.keyword}
                          <button
                            onClick={() => deleteRule.mutate(rule.id)}
                            disabled={deleteRule.isPending}
                            className="hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {category.rules.length === 0 && (
                        <span className="text-xs text-slate-400 italic">
                          Nessuna parola chiave: assegnabile solo manualmente
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddKeyword(category.id);
                          }
                        }}
                        placeholder="Nuova parola chiave (es. esselunga)"
                        className="input text-sm flex-1 max-w-xs"
                      />
                      <button
                        onClick={() => handleAddKeyword(category.id)}
                        disabled={addRule.isPending || newKeyword.trim().length < 2}
                        className="btn btn-secondary text-sm"
                      >
                        {addRule.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New category form */}
      <form onSubmit={handleCreateCategory} className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="font-medium text-slate-900">Aggiungi categoria</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nome (es. Animali)"
            className="input flex-1"
          />
          <input
            type="color"
            value={newCategoryColor}
            onChange={(e) => setNewCategoryColor(e.target.value)}
            className="h-10 w-14 rounded-lg border border-slate-200 cursor-pointer"
            title="Colore della categoria"
          />
        </div>
        <input
          type="text"
          value={newCategoryKeywords}
          onChange={(e) => setNewCategoryKeywords(e.target.value)}
          placeholder="Parole chiave separate da virgola (es. veterinario, crocchette)"
          className="input"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={createCategory.isPending || !newCategoryName.trim()}
            className="btn btn-primary"
          >
            {createCategory.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Crea categoria
          </button>
        </div>
      </form>
    </section>
  );
}
