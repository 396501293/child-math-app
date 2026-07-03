import type { Question } from '../../core/types';

interface OptionsProps {
  question: Question;
  excluded: number[]; // 本题已答错、排除的选项值
  feedback: 'right' | 'wrong' | null;
  onPick: (value: number) => void;
}

// 3 个选项卡片。excluded 项 60% 透明且禁用；答对时正确项闪青绿；答错瞬间排除项 shake。
export function Options({ question, excluded, feedback, onPick }: OptionsProps) {
  return (
    <div class="mn-opts">
      {question.options.map((v, i) => {
        const isExcluded = excluded.includes(v);
        const isCorrectFlash = feedback === 'right' && v === question.answer;
        let cls = 'mn-opt';
        if (isCorrectFlash) cls = 'mn-opt mn-opt--correct';
        else if (isExcluded) cls = 'mn-opt mn-opt--excluded' + (feedback === 'wrong' ? ' mn-opt--shake' : '');
        const clickable = !isExcluded && !isCorrectFlash && feedback === null;
        return (
          <div key={i} class={cls} onClick={clickable ? () => onPick(v) : undefined}>
            {v}
          </div>
        );
      })}
    </div>
  );
}
