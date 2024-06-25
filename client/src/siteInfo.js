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

    load() {
        for(const r of Object.keys(regions)){
            const locale = this.localization.getLocale();
            const siteInfoUrl = api.resolveUrl("http"+region_name(r)+`/api/site_info?language=${locale}`);

            $.ajax(siteInfoUrl).done((data, _status) => {
                this.info[r] = data || {};
                this.loaded = true;
                this.updatePageFromInfo();
            });
        }
    }

    getGameModeStyles() {
        const modeTypes = {
            1: "solo",
            2: "duo",
            4: "squad"
        };
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
            availableModes.push({
                icon: mapDef.icon,
                buttonCss: mapDef.buttonCss,
                buttonText
            });
        }
        return availableModes;
    }

    updatePageFromInfo() {
        if (this.loaded) {
            const e = this.getGameModeStyles();
            for (
                let t = 0;
                t < e.length;
                t++
            ) {
                const r = e[t];
                const a = `index-play-${r.buttonText}`;
                const o = $(`#btn-start-mode-${t}`);
                o.data("l10n", a);
                o.html(this.localization.translate(a));
                if (r.icon || r.buttonCss) {
                    if (t == 0) {
                        o.addClass("btn-custom-mode-no-indent");
                    } else {
                        o.addClass("btn-custom-mode-main");
                    }
                    o.addClass(r.buttonCss);
                    o.css({
                        "background-image": `url(${r.icon})`
                    });
                }
                const l = $(`#btn-team-queue-mode-${t}`);
                if (l.length) {
                    const c = `index-${r.buttonText}`;
                    l.data("l10n", c);
                    l.html(this.localization.translate(c));
                    if (r.icon) {
                        l.addClass("btn-custom-mode-select");
                        l.css({
                            "background-image": `url(${r.icon})`
                        });
                    }
                }
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
