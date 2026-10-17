export const RESTAURANT_MENU = [
  { id: "meal_sushi_bowl", name: "Sushi Bowl", description: "A fresh bowl of rice and fish.", price: 18, healing: 16, icon: "🍣", assetKey: "food-pack/sushiBowl.glb" },
  { id: "meal_beef_wellington", name: "Roast Wellington", description: "A hearty roast wrapped in pastry.", price: 32, healing: 30, icon: "🥩", assetKey: "food-pack/beefWellingtonCutPieceBig.glb" },
  { id: "meal_sausage", name: "Grilled Sausage", description: "A hot meal fresh from the grill.", price: 14, healing: 12, icon: "🌭", assetKey: "food-pack/casedSausageWhole.glb" },
  { id: "meal_fries", name: "Golden Fries", description: "Crispy potatoes with a pinch of salt.", price: 10, healing: 8, icon: "🍟", assetKey: "food-pack/potatoFries.glb" },
  { id: "meal_fruit", name: "Fruit Bowl", description: "A bright, refreshing bowl of fruit.", price: 12, healing: 10, icon: "🍊", assetKey: "food-pack/orange.glb" },
];

export const RESTAURANT_MENU_BY_ID = new Map(RESTAURANT_MENU.map((meal) => [meal.id, meal]));
