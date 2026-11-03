export type Track = {
  id: string;
  title: string;
  artist: string;
  src: string;
  loaderLabel: string;
  gain: number;
};

export const tracks: Track[] = [
  {
    id: 'flashing-lights',
    title: 'Flashing Lights',
    artist: 'Kanye West',
    src: '/kanye_-_flashing_lights_(mp3.pm).mp3',
    loaderLabel: 'FLASHING LIGHTS',
    gain: 0.04,
  },
  {
    id: 'sundress',
    title: 'Sundress',
    artist: 'A$AP Rocky',
    src: '/ASAP_Rocky_-_Sundress_(mp3.pm).mp3',
    loaderLabel: 'SUNDRESS',
    gain: 0.04,
  },
];
