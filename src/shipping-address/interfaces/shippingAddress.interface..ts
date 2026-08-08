export interface ShippingAddressDocument extends Document {

    source: string;
    address: string;
    origin: string;
    weightCharge: string;
}
