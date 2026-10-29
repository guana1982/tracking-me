import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

interface SavingsInfoModalProps {
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

/**
 * Explains every figure of the savings card. Stacked above SavingsExpandedModal,
 * which owns its open state and its Escape handling.
 */
export function SavingsInfoModal({ onClose }: SavingsInfoModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Come leggere i risparmi"
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-slate-900">Come leggere i risparmi</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Chiudi spiegazione"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-5">
          <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-900">
            L&apos;<strong>accantonato</strong> dice quanto è finito nei risparmi, al netto degli Extra pagati con quei
            soldi. Il <strong>saldo reale</strong> dice quanto ti è rimasto in tutto.
          </p>

          <Section title="Le cifre in alto">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Accantonato mese</strong>: l&apos;accantonato netto del mese selezionato.</li>
              <li><strong>Mesi precedenti</strong>: la somma dell&apos;accantonato dei mesi prima di quello selezionato.</li>
              <li><strong>Media / mese</strong>: la media dell&apos;accantonato sui mesi chiusi; il mese in corso non conta.</li>
              <li><strong>Accantonato netto</strong>: il totale accantonato su tutti i mesi registrati.</li>
            </ul>
          </Section>

          <Section title="Accantonato netto mensile">
            <p>
              Per ogni mese: <strong>bonifici a Risparmi + riallocazioni verso Risparmi − spese Extra</strong>.
            </p>
            <p>
              Le spese Extra (vacanze, spese fuori budget) si pagano dal conto risparmi, quindi quei soldi non sono più
              messi da parte e vengono tolti.
            </p>
            <p>
              Una riallocazione sposta a Risparmi l&apos;avanzo di budget di un&apos;altra categoria. Siccome l&apos;avanzo
              di budget può essere più alto dei soldi davvero rimasti, conta al massimo quanto è rimasto davvero: entrate
              meno spese ordinarie meno bonifici a Risparmi. Quando viene limitata, il tooltip della barra lo segnala.
            </p>
            <p>La linea verde tratteggiata è la media sui mesi chiusi.</p>
          </Section>

          <Section title="Saldo reale mensile">
            <p>
              Per ogni mese: <strong>entrate − tutte le uscite reali</strong> (Necessità, Svago ed Extra).
            </p>
            <p>
              I bonifici a Risparmi non sono uscite, perché i soldi restano tuoi. Gli avanzi portati dal mese prima e le
              righe di riporto non contano, perché sono soldi o spese del mese precedente.
            </p>
            <p>
              La differenza con l&apos;accantonato è, in genere, quello che è rimasto sul conto corrente senza essere
              spostato nei risparmi.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>La linea verde tratteggiata è la media sui mesi chiusi.</li>
              <li>La linea viola è il saldo accumulato da inizio anno, solo sui mesi chiusi.</li>
              <li>
                <strong>Mese in corso</strong>: la barra a righe è la proiezione a fine periodo (spese fisse come
                registrate, spese variabili al ritmo giornaliero di oggi fino al giorno di paga) e il punto grigio è il
                saldo finora. Non entra né nella media né nel totale da inizio anno.
              </li>
              <li>
                <strong>Escludi entrate straordinarie</strong>: toglie le entrate segnate come straordinarie (bonus,
                rimborsi, regali) e mostra il saldo strutturale, cioè quanto ti lascia lo stipendio da solo.
              </li>
            </ul>
          </Section>

          <Section title="Spese totali mensili">
            <p>
              Tutte le righe di spesa registrate nel mese, compresi bonifici a Risparmi, Extra e riporti. Serve a vedere
              quanto è uscito in totale, non quanto hai speso per vivere.
            </p>
          </Section>

          <p className="text-xs text-slate-500">
            Cliccando una barra di qualsiasi grafico selezioni quel mese nella dashboard.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
