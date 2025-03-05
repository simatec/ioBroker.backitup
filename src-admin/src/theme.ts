// this file used only for simulation and not used in end build
import { Theme, ThemeName } from '@iobroker/adapter-react-v5';

export default (type: ThemeName) => {
    const danger = '#dd5325';
    const success = '#73b6a8';
    const theme = { ...Theme(type) };
    if (!theme) {
        return theme;
    }
    (theme.palette.text as any).danger = {
        color: danger,
    };
    (theme.palette.text as any).success = {
        color: success,
    };

    return theme;
};
