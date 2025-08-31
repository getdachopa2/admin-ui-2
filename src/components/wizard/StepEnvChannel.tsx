import React from 'react';
import ClearInput from '@/components/ClearInput';

export type Env = 'stb' | 'prp';
export type StepEnvChannelValue = {
  env: Env;
  channelId: string;
  // ileride açılacak (çoklu kanal) – sadece UI comment olarak bıraktık:
  // channels?: Array<{ env: Env; channelId: string }>;
};

export default function StepEnvChannel({
  value,
  onChange,
}: {
  value: StepEnvChannelValue;
  onChange: (v: StepEnvChannelValue) => void;
}) {
  const set = <K extends keyof StepEnvChannelValue>(k: K, v: StepEnvChannelValue[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <div className="mb-1 text-xs text-neutral-500">Ortam</div>
          <select
            className="input text-sm"
            value={value.env}
            onChange={(e) => set('env', (e.target.value as Env) || 'stb')}
          >
            <option value="stb">STB</option>
            <option value="prp">PRP</option>
          </select>
        </label>

        <ClearInput
          label="Channel ID (tek)"
          value={value.channelId}
          onChange={(v) => set('channelId', v)}
          placeholder="örn. 999134"
          className="md:col-span-2"
        />
      </div>

      {/* 
        İLERİDE: Çoklu kanal desteği (yorumda tutuyoruz, backend hazır olunca açacağız)
        <div className="space-y-2">
          <div className="text-xs text-neutral-500">Çoklu Kanal (yakında)</div>
          <div className="text-xs text-neutral-600">
            Tek bir “Start” ile birden çok (env, kanal) gönderimi burada tanımlanacak.
          </div>
        </div>
      */}
    </div>
  );
}
