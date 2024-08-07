import $ from "jquery";
import { api } from "./api";
import { device } from "./device";
import { MapDefs } from "../../shared/defs/mapDefs";
import { region_name, regions, streamers, youtubers } from "./config";

export class SiteInfo {
    /**
     *
     * @param {import('./config').ConfigManager} config
     * @param {import('./ui/localization').Localization} localization
     */
    constructor(config, localization) {
        this.config = config;
        this.localization = localization;
        this.info = {};
        this.loaded = false;
    }

    load(app) {
        for(const r of Object.keys(regions)){
            const locale = this.localization.getLocale();
            const siteInfoUrl = api.resolveUrl("http"+region_name(r)+`/api/info?language=${locale}`);

            $.ajax(siteInfoUrl).done((data, _status) => {
                this.info[r] = data || {};
                this.loaded = true;
                this.updatePageFromInfo(app);
            });
        }
    }

    getGameModeStyles() {
        const modeTypes = {
            1: "solo",
            2: "duo",
            3: "trio",
            4: "squad"
        };
        const icons={
            1:"img/gui/surviv-1.svg",
            2:"img/gui/surviv-2.svg",
            3:"img/gui/surviv-3.svg",
            4:"img/gui/surviv-4.svg",
        }
        const availableModes = [];
        const modes = this.info[this.config.get("region")].modes || [];
        for (
            let i = 0;
            i < modes.length;
            i++
        ) {
            const mode = modes[i];
            const mapDef = (MapDefs[mode.mapName] || MapDefs.main).desc;
            const buttonText = mapDef.buttonText ? mapDef.buttonText : modeTypes[mode.teamMode];
            let icon=mapDef.icon
            if(!mapDef.buttonText){
                icon=icons[mode.teamMode]
            }
            availableModes.push({
                icon: icon??"img/gui/surviv-1.svg",
                buttonCss: mapDef.buttonCss,
                buttonText:buttonText??"solo"
            });
        }
        return availableModes;
    }

    updatePageFromInfo(app) {
        if (this.loaded) {
            const e = this.getGameModeStyles();
            const btns=document.querySelector("#btns-quick-start")
            btns.innerHTML=""
            function qs(t){
                return ()=>{
                    app.tryQuickStartGame(t)
                }
            }
            for (
                let t = 0;
                t < e.length;
                t++
            ) {
                const r = e[t];
                const a=`index-play-${e[t].buttonText}`
                const o = document.createElement("button");
                const ic=document.createElement("img")
                ic.id="icon"
                o.classList.add("menu-option","play-button")
                o.id=`btn-start-mode-${t}`
                o.innerText=this.localization.translate(a)
                o.setAttribute("value",t)
                o.setAttribute("l10n", a);
                o.addEventListener("click",qs(t))
                if (r.icon || r.buttonCss) {
                    /*if (r.icon) {
                        o.classList.add("btn-custom-mode-no-indent");
                    } else {
                        o.classList.add("btn-custom-mode-main");
                    }*/
                    if(r.buttonCss){
                        o.classList.add(r.buttonCss);
                    }
                    ic.src=`${r.icon}`
                    ic.style.width="13%"
                    ic.style.left="2px"
                    ic.style.position="absolute"
                    ic.style.margin="auto"
                    ic.style.top="0px"
                    ic.style.bottom="0px"
                    o.appendChild(ic)
                }
                btns.appendChild(o)
            }

            // Region pops
            for(const region of Object.keys(this.info)){
                if (this.info[region]&&this.info[region].players!==undefined) {
                    const count = this.info[region].players;
                    const sel = $("#server-opts").children(
                        `option[value="${region}"]`
                    ).get()[0];
                    const text=(`${regions[region].name} [${count} players]`)
                    sel.innerHTML=text;
                    sel.label=text;
                }
            }
            
            let hasTwitchStreamers = false;
            const featuredStreamersElem = $("#featured-streamers");
            const streamerList = $(".streamer-list");
            if (!device.mobile) {
                streamerList.empty();
                for (let i = 0; i < streamers.length; i++) {
                    const streamer = streamers[i];
                    const template = $(
                        "#featured-streamer-template"
                    ).clone();
                    template.attr(
                        "class",
                        "featured-streamer streamer-tooltip"
                    ).attr("id", "");
                    const link = template.find("a");
                    const text = this.localization.translate(
                        streamer.viewers == 1
                            ? "index-viewer"
                            : "index-viewers"
                    );
                    link.html(
                        `${streamer.name} <span>${streamer.viewers} ${text}</span>`
                    );
                    link.css("background-image", `url(${streamer.img})`);
                    link.attr("href", streamer.url);
                    streamerList.append(template);
                    hasTwitchStreamers = true;
                }
            }
            featuredStreamersElem.css("visibility", hasTwitchStreamers ? "visible" : "hidden");

            const featuredYoutuberElem = $("#featured-youtuber");
            const displayYoutuber = Object.keys(youtubers)[Math.floor(Math.random()*Object.keys(youtubers).length)];
            if (displayYoutuber) {
                $(".btn-youtuber")
                    .attr("href", youtubers[displayYoutuber])
                    .html(displayYoutuber);
            }
            featuredYoutuberElem.css("display", displayYoutuber ? "block" : "none");
        }
    }
}
