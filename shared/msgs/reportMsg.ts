import { AbstractMsg, type BitStream } from "../net";

export class ReportMsg extends AbstractMsg {
    code:string=""

    override serialize(s: BitStream) {
        s.writeUint16(this.code.length)
        s.writeString(this.code)
    }

    override deserialize(s: BitStream) {
        const size=s.readUint16()
        this.code=s.readString(size)
        s.readBits(5);
    }
}
