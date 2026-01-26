export const addictionContent = {
  alcohol: {
    quotes: [
      "Every sober day is a victory. You're choosing life over alcohol.",
      "The bottle promised freedom but delivered chains. You're breaking free.",
      "Your health, relationships, and future are worth more than any drink.",
      "One day at a time. You're stronger than alcohol.",
      "Sobriety is giving you the life alcohol took away.",
    ],
    copingStrategies: [
      "Call a sober friend or sponsor",
      "Attend an AA meeting",
      "Drink sparkling water or tea",
      "Go for a walk or exercise",
      "Practice the HALT method (Hungry, Angry, Lonely, Tired)",
    ],
    resources: [
      { name: "Alcoholics Anonymous", url: "https://www.aa.org" },
      { name: "SMART Recovery", url: "https://www.smartrecovery.org" },
    ],
  },
  drugs: {
    quotes: [
      "Recovery is hard. Regret is harder. Choose recovery.",
      "You're not giving up drugs, you're gaining your life back.",
      "Every clean day is a miracle. Keep going.",
      "The pain of staying the same is greater than the pain of change.",
      "Your brain is healing. Give it time and stay strong.",
    ],
    copingStrategies: [
      "Contact your sponsor immediately",
      "Attend a NA meeting",
      "Use the 5-minute rule: Wait 5 minutes before acting",
      "Practice deep breathing exercises",
      "Engage in physical activity",
    ],
    resources: [
      { name: "Narcotics Anonymous", url: "https://www.na.org" },
      { name: "SAMHSA Helpline", url: "https://www.samhsa.gov/find-help/national-helpline" },
    ],
  },
  smoking: {
    quotes: [
      "Every cigarette you don't smoke is doing you good.",
      "You're stronger than nicotine. Prove it today.",
      "Your lungs are thanking you with every smoke-free breath.",
      "Cravings pass. Your commitment stays. Keep going.",
      "Freedom from smoking is the best gift you can give yourself.",
    ],
    copingStrategies: [
      "Chew gum or eat healthy snacks",
      "Do deep breathing exercises",
      "Take a quick walk",
      "Drink cold water",
      "Keep your hands busy with a fidget toy",
    ],
    resources: [
      { name: "Smokefree.gov", url: "https://smokefree.gov" },
      { name: "QuitGuide App", url: "https://smokefree.gov/tools-tips/apps" },
    ],
  },
  pornography: {
    quotes: [
      "Real intimacy is worth more than pixels. Stay strong.",
      "You're rewiring your brain for authentic connection.",
      "Freedom from this addiction opens doors to genuine relationships.",
      "Every day clean is a day of reclaiming your sexuality.",
      "Your mind deserves better. Your future self will thank you.",
    ],
    copingStrategies: [
      "Use website blockers and accountability software",
      "Get outside and engage with real people",
      "Exercise to redirect energy",
      "Call an accountability partner",
      "Practice mindfulness meditation",
    ],
    resources: [
      { name: "NoFap Community", url: "https://nofap.com" },
      { name: "Fight the New Drug", url: "https://fightthenewdrug.org" },
    ],
  },
  gambling: {
    quotes: [
      "The best bet is on yourself. Stay strong.",
      "Real wealth is freedom from gambling. You're building it.",
      "Every day without gambling is a winning day.",
      "You're not giving up excitement, you're gaining control.",
      "Your future is worth more than any jackpot.",
    ],
    copingStrategies: [
      "Self-exclude from gambling venues",
      "Hand over finances to a trusted person temporarily",
      "Attend a GA meeting",
      "Find alternative activities for excitement",
      "Use urge-tracking tools",
    ],
    resources: [
      { name: "Gamblers Anonymous", url: "https://www.gamblersanonymous.org" },
      { name: "National Council on Problem Gambling", url: "https://www.ncpgambling.org" },
    ],
  },
  gaming: {
    quotes: [
      "Life is the real game. Start playing it.",
      "Your potential exists outside the screen. Go find it.",
      "Balance is possible. You're learning it now.",
      "Real achievements matter more than virtual ones.",
      "You're leveling up in real life. Keep going.",
    ],
    copingStrategies: [
      "Set strict time limits with app blockers",
      "Find replacement hobbies (sports, music, art)",
      "Uninstall problem games",
      "Join real-world social activities",
      "Create a daily schedule with non-gaming activities",
    ],
    resources: [
      { name: "Game Quitters", url: "https://gamequitters.com" },
      { name: "OLGA (Online Gamers Anonymous)", url: "https://www.olganon.org" },
    ],
  },
  food: {
    quotes: [
      "You're nourishing your body, not punishing it. Progress over perfection.",
      "Every healthy choice is an act of self-love.",
      "Food is fuel, not the enemy. You're finding balance.",
      "Your relationship with food is healing. Be patient with yourself.",
      "You deserve to be free from food's control.",
    ],
    copingStrategies: [
      "Practice mindful eating",
      "Keep a food and emotion journal",
      "Eat regular, balanced meals",
      "Find non-food ways to cope with emotions",
      "Reach out to support groups",
    ],
    resources: [
      { name: "Overeaters Anonymous", url: "https://oa.org" },
      { name: "National Eating Disorders Association", url: "https://www.nationaleatingdisorders.org" },
    ],
  },
  other: {
    quotes: [
      "Recovery is not a race. You don't have to feel guilty if it takes you longer than you thought.",
      "One day at a time. You've got this!",
      "You are stronger than your struggles.",
      "Progress, not perfection.",
      "Every step forward is a victory.",
    ],
    copingStrategies: [
      "Identify your personal triggers",
      "Build a support network",
      "Practice self-care daily",
      "Use mindfulness techniques",
      "Seek professional help when needed",
    ],
    resources: [
      { name: "SMART Recovery", url: "https://www.smartrecovery.org" },
      { name: "Psychology Today - Find a Therapist", url: "https://www.psychologytoday.com/us/therapists" },
    ],
  },
};

export const getAddictionContent = (addictionType: string | null) => {
  if (!addictionType || !(addictionType in addictionContent)) {
    return addictionContent.other;
  }
  return addictionContent[addictionType as keyof typeof addictionContent];
};
