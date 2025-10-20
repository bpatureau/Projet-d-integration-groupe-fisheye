from machine import Pin, I2C, ADC
import ssd1306
import time
from random import randint
import neopixel

prof_array = {"xav": [],
              "de smet": [],
              "vds" : [],
              "scalpel" : []}

index_prof = 0

for i in prof_array:
    prof_array[i] = [randint(0, 2) for x in range(20)]


print(prof_array)

pot = ADC(28)

np = neopixel.NeoPixel(Pin(15), 40)

for x in range(40):
    np[x] = (10, 10, 10)

np.write()


# using default address 0x3C
i2c = I2C(sda=Pin(0), scl=Pin(1))
display = ssd1306.SSD1306_I2C(128, 32, i2c)

display.rotate(2)

display.text('Prof: ', 0, 0)
display.text([key for key in prof_array][index_prof], 0, 10)
display.text('Hello, World 3!', 0, 20)



display.show()

while True:
    try:
        if pot.read_u16() > 20_000:
            index_prof += 1

            if index_prof == len(prof_array):
                index_prof = 0
            display.fill_rect(0, 10, 128, 10, 0)
            display.text([key for key in prof_array][index_prof], 0, 10)
            display.show()

            value = list(prof_array.values())[index_prof]
            print(value)

            convert = {0 : (0, 255, 0), 1 : (255, 255, 0), 2 : (255, 0, 0)}

            for x, y in zip(range(0, 40, 2), range(20)):
                np[x] = convert[value[y]]
                np[x+1] = convert[value[y]]

            np.write()

            time.sleep(0.5)

    except KeyboardInterrupt:
        for x in range(40):
            np[x] = (0, 0, 0)
            np.write()
            print('wipe strip')