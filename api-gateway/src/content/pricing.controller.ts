import { Controller, Get, Post, Put, Delete, Body, Param, Query, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Content')
@Controller('content/pricing')
export class PricingController {
    constructor(
        @Inject('CONTENT_SERVICE') private readonly client: ClientProxy,
    ) { }

    @Get('plans')
    @ApiOperation({ summary: 'Get all pricing plans' })
    async findAll(@Query('activeOnly') activeOnly: boolean = true) {
        return this.client.send('pricing.findAll', activeOnly);
    }

    @Get('plans/:id')
    @ApiOperation({ summary: 'Get a pricing plan by ID' })
    async findOne(@Param('id') id: string) {
        return this.client.send('pricing.findOne', id);
    }

    @Post('plans')
    @ApiOperation({ summary: 'Create a new pricing plan (Admin)' })
    async create(@Body() data: any) {
        return this.client.send('pricing.create', data);
    }

    @Put('plans/:id')
    @ApiOperation({ summary: 'Update a pricing plan (Admin)' })
    async update(@Param('id') id: string, @Body() data: any) {
        return this.client.send('pricing.update', { id, data });
    }

    @Delete('plans/:id')
    @ApiOperation({ summary: 'Delete a pricing plan (Admin)' })
    async delete(@Param('id') id: string) {
        return this.client.send('pricing.delete', id);
    }
}
