export const SILVERMOON_HEALTH_POTION_RECIPE = {
  key: 'silvermoon-health-potion',
  name: 'Silvermoon Health Potion',
  output: {
    itemId: 241305,
    quantity: 5,
  },
  materials: [
    {
      name: 'Tranquility Bloom',
      itemId: 236761,
      quantity: 6,
    },
    {
      name: 'Sunglass Vial',
      itemId: 240991,
      quantity: 5,
    },
  ],
} as const;