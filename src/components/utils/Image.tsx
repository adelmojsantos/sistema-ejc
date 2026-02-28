import type { ImgHTMLAttributes } from "react"
import Logo from "../../assets/logo-ejc.svg"

const LogoImage = (props: ImgHTMLAttributes<HTMLImageElement>) => {
    return (
        <img src={Logo} alt="Logo EJC" style={{ objectFit: 'contain', backgroundColor: 'white', borderRadius: '50%' }} {...props} />
    )
}

export { LogoImage }