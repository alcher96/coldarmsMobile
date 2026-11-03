import { useState } from 'react';

import { formatPct, handName, type AnthroKey, type AnthroTop } from '@/api/analytics';
import { AthleteRow, Block, Chips, ShowMore } from '@/components/analytics/kit';

/** Мерки — в порядке сайта; единицы у всех, кроме веса, — сантиметры. */
const CATS: { key: AnthroKey; label: string; unit: string }[] = [
  { key: 'wrist', label: 'Запястье', unit: 'см' },
  { key: 'forearm', label: 'Предплечье', unit: 'см' },
  { key: 'bicep', label: 'Бицепс', unit: 'см' },
  { key: 'weight', label: 'Вес', unit: 'кг' },
  { key: 'height', label: 'Рост', unit: 'см' },
];

const FEW = 10;

/** «Антропометрический топ»: топ-25 по каждой мерке; рядом — лучшая рука атлета и её винрейт. */
export function AnthroSection({ data }: { data: AnthroTop }) {
  const [cat, setCat] = useState<AnthroKey>('wrist');
  const [all, setAll] = useState(false);
  const meta = CATS.find((c) => c.key === cat)!;
  const list = data.categories[cat] ?? [];
  const shown = all ? list : list.slice(0, FEW);

  return (
    <Block>
      <Chips
        options={CATS}
        value={cat}
        onChange={(k) => {
          setCat(k);
          setAll(false);
        }}
      />
      {shown.map((e) => (
        <AthleteRow
          key={e.armWrestlerId}
          id={e.armWrestlerId}
          name={e.fullName}
          country={e.country}
          rank={e.rank}
          sub={`${handName(e.bestHand)} · ${formatPct(e.bestHandWinRate)} побед`}
          right={`${e.value} ${meta.unit}`}
        />
      ))}
      {list.length > FEW ? <ShowMore expanded={all} total={list.length} onPress={() => setAll((v) => !v)} /> : null}
    </Block>
  );
}
