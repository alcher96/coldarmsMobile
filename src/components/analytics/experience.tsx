import { View } from 'react-native';

import { formatNumber, formatPct, type FightExperience } from '@/api/analytics';
import { AthleteRow, BarRow, BigStat, Block } from '@/components/analytics/kit';
import { plural } from '@/lib/format';

const fightsLabel = (label: string) => (label === '1' ? '1 бой' : label.endsWith('+') ? `${label} боёв` : `${label} ${plural(Number(label), ['бой', 'боя', 'боёв'])}`);

/** «Боевой опыт»: сколько боёв за плечами у атлетов базы и кто провёл больше всех. */
export function ExperienceSection({ data }: { data: FightExperience }) {
  const max = Math.max(1, ...data.buckets.map((b) => b.athleteCount));
  return (
    <View style={{ gap: 12 }}>
      <Block
        title="Сколько боёв за плечами"
        note="Число справа — сколько атлетов провели столько боёв. Считаются завершённые поединки; правая и левая рука — отдельные бои.">
        {data.buckets.map((b) => (
          <BarRow
            key={b.label}
            label={fightsLabel(b.label)}
            value={String(b.athleteCount)}
            fraction={b.athleteCount / max}
          />
        ))}
        <BigStat value={formatNumber(data.averageFightsPerAthlete)} text="боя в среднем на атлета" />
      </Block>
      <Block
        title="Ветераны стола"
        note={`Рекорд базы — ${data.maxFights} ${plural(data.maxFights, ['бой', 'боя', 'боёв'])}, при этом большинство атлетов провели лишь один-два: топовый армрестлинг — редкие и дорогие матчи.`}>
        {data.veterans.map((v, i) => (
          <AthleteRow
            key={v.armWrestlerId}
            id={v.armWrestlerId}
            name={v.fullName}
            country={v.country}
            rank={i + 1}
            sub={`Win rate ${formatPct(v.winRate)}`}
            right={String(v.fights)}
            rightSub={plural(v.fights, ['бой', 'боя', 'боёв'])}
          />
        ))}
      </Block>
    </View>
  );
}
