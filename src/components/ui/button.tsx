import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[6px] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[transform,background-color,color,border-color] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none focus-visible:border-foreground focus-visible:ring-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/80",
        outline:
          "border-[color:var(--ds-border-strong,#333)] bg-transparent aria-expanded:border-foreground aria-expanded:text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:border-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground aria-expanded:bg-secondary aria-expanded:text-secondary-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        ghost:
          "aria-expanded:bg-muted aria-expanded:text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:border-destructive [@media(hover:hover)_and_(pointer:fine)]:hover:bg-destructive/20 dark:bg-destructive/20 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-destructive/30",
        link: "rounded-none text-primary underline-offset-4 active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-[4px] px-2 text-xs in-data-[slot=button-group]:rounded-[4px] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 rounded-[6px] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-[6px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[4px] in-data-[slot=button-group]:rounded-[4px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[6px] in-data-[slot=button-group]:rounded-[6px]",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
