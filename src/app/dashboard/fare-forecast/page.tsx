import type {Metadata} from 'next';
import SevenDayFare from '@/components/dashboard/seven-day-fare';
export const metadata:Metadata={title:'Seven-day Fare Forecast | TBO Assemble'};
export default function FareForecastPage(){return <SevenDayFare/>}
