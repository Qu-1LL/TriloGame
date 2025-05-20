
export class Ore {
    constructor(name) {
        this.name = name    //String
    }

    static SANDSTONE = new Ore("Sandstone")
    static MALACHITE = new Ore("Malachite")
    static MAGNETITE = new Ore("Magnetite")
    static PEROTENE = new Ore("Perotene")
    static ILMENITE = new Ore("Ilmenite")
    static COCHINIUM = new Ore("Cochinium")

    static getOres() {
        //make sure they are ordered by rarity asc
        return [this.SANDSTONE,this.MAGNETITE,this.MALACHITE,this.PEROTENE,this.ILMENITE,this.COCHINIUM]
    }

    toString() {
        return this.name
    }
}