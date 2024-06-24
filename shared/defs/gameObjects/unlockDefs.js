import { CrosshairDefs } from "./crosshairDefs";
import { HealEffectDefs } from "./healEffectDefs";
import { PassDefs } from "./passDefs";

const allowedHealEffects = Object.keys(HealEffectDefs);
const allowedGuns = [
    "",
    //Pistol:
   "ots38", "m9", "m9_dual", "hud-m9_dual", "m93r", 
   "m93r_dual", "hud_m93r_dual", "glock", "glock_dual", "hud_glock_dual", 
   "p30l", "p30l_dual", "ot38", "ot38_dual", "hud-ot38_dual", 
   "ots38_dual", "hud_ots38_dual", "deagle", "deagle_dual", "hud_deagle_dual", 
   "colt45", "colt45_dual", "hud_colt45_dual", "m1911", "m1911_dual", "hud_m1911_dual",

   //Submachine Guns (SMG):
   "mp5", "mac10", "ump9", "vector", "vector45", "scorpion",

   //Shotguns:
    "m870", "m1100", "m1014", "mp220", "usas", "saiga", "spas12",

    //Sniper Rifles:
    "sv98", "mosin", "m39", "garand", "svd", "vss", "scout_elite", "model94",

    //Assault Rifles:
    "ak47", "scar", "an94", "groza", "grozas", "famas", "hk416", "m4a1", "mk12", "scarssr",

   //Light Machine Guns (LMG):
    "dp28", "m249", "qbb97", "l86", "bar", "pkp",

    //Others:
    "blr", "m1a1"


];
const allowedMeleeSkins = [
    "fists", "knuckles_rusted", "knuckles_heroic", "karambit_rugged", "karambit_prismatic", "karambit_drowned", "bayonet_rugged", "bayonet_woodland", "huntsman_rugged", "huntsman_burnished", "bowie_vintage", "bowie_frontier"
];
const allowedOutfits = [
    "outfitBase", "outfitTurkey", "outfitDev", "outfitMod", "outfitWheat", "outfitNoir", "outfitRedLeaderAged", "outfitBlueLeaderAged", "outfitSpetsnaz", "outfitWoodsCloak", "outfitElf", "outfitImperial", "outfitLumber", "outfitVerde", "outfitPineapple", "outfitTarkhany", "outfitWaterElem", "outfitHeaven", "outfitMeteor", "outfitIslander", "outfitAqua", "outfitCoral", "outfitKhaki", "outfitParma", "outfitParmaPrestige", "outfitCasanova", "outfitPrisoner", "outfitJester", "outfitWoodland", "outfitRoyalFortune", "outfitKeyLime", "outfitCobaltShell", "outfitCarbonFiber", "outfitDarkGloves", "outfitDarkShirt", "outfitDesertCamo", "outfitCamo", "outfitRed", "outfitWhite"
];
const allowedEmotes = [
    "emote_thumbsup", "emote_sadface", "emote_happyface", "emote_surviv", "emote_gg", "emote_question", "emote_tombstone", "emote_joyface", "emote_sobface", "emote_thinkingface", "emote_flagus", "emote_flagthailand", "emote_flaggermany", "emote_flagfrance", "emote_flagsouthkorea", "emote_flagbrazil", "emote_flagcanada", "emote_flagspain", "emote_flagrussia", "emote_flagmexico", "emote_flagpoland", "emote_flaguk", "emote_flagcolombia", "emote_flagukraine", "emote_flagturkey", "emote_flagphilippines", "emote_flagczechia", "emote_flagperu", "emote_flagaustria", "emote_flagargentina", "emote_flagjapan", "emote_flagvenezuela", "emote_flagvietnam", "emote_flagswitzerland", "emote_flagnetherlands", "emote_flagchina", "emote_flagtaiwan", "emote_flagchile", "emote_flagaustralia", "emote_flagdenmark", "emote_flagitaly", "emote_flagsweden", "emote_flagecuador", "emote_flagslovakia", "emote_flaghungary", "emote_flagromania", "emote_flaghongkong", "emote_flagindonesia", "emote_flagfinland", "emote_flagnorway", "emote_heart", "emote_sleepy", "emote_flex", "emote_angryface", "emote_upsidedownface", "emote_teabag", "emote_alienface", "emote_flagbelarus", "emote_flagbelgium", "emote_flagkazakhstan", "emote_egg", "emote_police", "emote_dabface", "emote_flagmalaysia", "emote_flagnewzealand", "emote_logosurviv", "emote_logoegg", "emote_logoswine", "emote_logohydra", "emote_logostorm", "emote_flaghonduras", "emote_logocaduceus", "emote_impface", "emote_monocleface", "emote_sunglassface", "emote_headshotface", "emote_potato", "emote_leek", "emote_eggplant", "emote_baguette", "emote_chick", "emote_flagbolivia", "emote_flagcroatia", "emote_flagindia", "emote_flagisrael", "emote_flaggeorgia", "emote_flaggreece", "emote_flagguatemala", "emote_flagportugal", "emote_flagserbia", "emote_flagsingapore", "emote_flagtrinidad", "emote_flaguruguay", "emote_logoconch", "emote_pineapple", "emote_coconut", "emote_crab", "emote_whale", "emote_logometeor", "emote_salt", "emote_disappointface", "emote_logocrossing", "emote_fish", "emote_campfire", "emote_chickendinner", "emote_cattle", "emote_icecream", "emote_cupcake", "emote_donut", "emote_logohatchet", "emote_acorn", "emote_trunk", "emote_forest", "emote_pumpkin", "emote_candycorn", "emote_pilgrimhat", "emote_turkeyanimal", "emote_heartface", "emote_logochrysanthemum", "emote_santahat", "emote_snowman", "emote_snowflake", "emote_flagmorocco", "emote_flagestonia", "emote_flagalgeria", "emote_flagegypt", "emote_flagazerbaijan", "emote_flagalbania", "emote_flaglithuania", "emote_flaglatvia", "emote_flaguae", "emote_flagdominicanrepublic", "emote_logocloud", "emote_logotwins"
];

export const UnlockDefs = {
    unlock_default: {
        type: "unlock",
        name: "standard-issue",
        unlocks: [...new Set([
            ...allowedOutfits,
            ...allowedMeleeSkins,
            ...allowedEmotes,
            ...allowedGuns,
            ...allowedHealEffects,
            ...Object.keys(CrosshairDefs),
            ...PassDefs.pass_survivr1.items.map((item) => item.item)
        ])]
    },
    unlock_new_account: {
        type: "unlock",
        name: "new-account",
        free: true,
        unlocks: ["outfitDarkShirt"]
    }
};
