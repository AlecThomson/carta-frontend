import * as React from "react";
import * as Konva from "konva";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Ellipse, Group, Rect, Transformer} from "react-konva";
import {FrameStore, RegionStore, RegionType} from "../../../stores";
import {Colors} from "@blueprintjs/core";

export interface RectangularRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    listening: boolean;
    selected: boolean;
    onSelect?: (region: RegionStore) => void;
    onPanClick?: () => void;
}

@observer
export class RectangularRegionComponent extends React.Component<RectangularRegionComponentProps> {
    @observable selectedRegionRef;
    @observable centeredScaling;

    handleRef = (ref) => {
        if (ref && this.selectedRegionRef !== ref) {
            this.selectedRegionRef = ref;
        }
    };

    handleClick = (konvaEvent) => {
        const mouseEvent = konvaEvent.evt as MouseEvent;

        if (mouseEvent.button === 0) {
            // Select click
            if (this.props.onSelect) {
                this.props.onSelect(this.props.region);
            }
        } else if (mouseEvent.button === 2) {
            // Context click
            console.log("context click!");
        }
    };

    handleTransformStart = (konvaEvent) => {
        this.centeredScaling = !konvaEvent.evt.evt.ctrlKey;
        this.props.region.beginEditing();
    };

    handleTransformEnd = () => {
        this.props.region.endEditing();
    };

    handleTransform = (konvaEvent) => {
        if (konvaEvent.currentTarget && konvaEvent.currentTarget.node) {
            const anchor = konvaEvent.currentTarget.movingResizer as string;
            const node = konvaEvent.currentTarget.node() as Konva.Node;
            const region = this.props.region;
            if (anchor.indexOf("rotater") >= 0) {
                // handle rotation
                const rotation = node.rotation();
                region.setRotation(rotation);
            } else {
                // handle scaling
                let nodeScale = node.scale();
                node.setAttr("scaleX", 1);
                node.setAttr("scaleY", 1);

                if (nodeScale.x <= 0 || nodeScale.y <= 0) {
                    return;
                }

                const newWidth = Math.max(1e-3, region.controlPoints[1].x * nodeScale.x);
                const newHeight = Math.max(1e-3, region.controlPoints[1].y * nodeScale.y);
                if (this.centeredScaling) {
                    region.setControlPoint(1, {x: newWidth, y: newHeight});
                } else {
                    const deltaWidth = (newWidth - region.controlPoints[1].x) * (region.regionType === RegionType.ELLIPSE ? 2 : 1);
                    const deltaHeight = (newHeight - region.controlPoints[1].y) * (region.regionType === RegionType.ELLIPSE ? 2 : 1);
                    let center = {x: region.controlPoints[0].x, y: region.controlPoints[0].y};
                    const cosX = Math.cos(region.rotation * Math.PI / 180.0);
                    const sinX = Math.sin(region.rotation * Math.PI / 180.0);
                    if (anchor.indexOf("left") >= 0) {
                        center.x -= cosX * deltaWidth / 2.0;
                        center.y += sinX * deltaWidth / 2.0;
                    } else if (anchor.indexOf("right") >= 0) {
                        center.x += cosX * deltaWidth / 2.0;
                        center.y -= sinX * deltaWidth / 2.0;
                    }

                    if (anchor.indexOf("top") >= 0) {
                        center.y += cosX * deltaHeight / 2.0;
                        center.x += sinX * deltaHeight / 2.0;
                    } else if (anchor.indexOf("bottom") >= 0) {
                        center.y -= cosX * deltaHeight / 2.0;
                        center.x -= sinX * deltaHeight / 2.0;
                    }

                    region.setControlPoints([center, {x: newWidth, y: newHeight}]);
                }
            }
        }
    };

    handleDragStart = () => {
        if (this.props.onSelect) {
            this.props.onSelect(this.props.region);
        }
        this.props.region.beginEditing();
    };

    handleDragEnd = () => {
        this.props.region.endEditing();
    };

    handleDrag = (konvaEvent) => {
        if (konvaEvent.target) {
            const node = konvaEvent.target as Konva.Node;
            const region = this.props.region;
            const frame = this.props.frame;
            const centerImageSpace = region.controlPoints[0];

            const currentCenterPixelSpace = this.getCanvasPos(centerImageSpace.x, centerImageSpace.y);
            const newCenterPixelSpace = node.position();
            const deltaPositionImageSpace = {x: (newCenterPixelSpace.x - currentCenterPixelSpace.x) / frame.zoomLevel, y: -(newCenterPixelSpace.y - currentCenterPixelSpace.y) / frame.zoomLevel};
            const newPosition = {x: centerImageSpace.x + deltaPositionImageSpace.x, y: centerImageSpace.y + deltaPositionImageSpace.y};
            region.setControlPoint(0, newPosition);
        }
    };

    private getCanvasPos(imageX: number, imageY: number) {
        const currentView = this.props.frame.requiredFrameView;
        const viewWidth = currentView.xMax - currentView.xMin;
        const viewHeight = currentView.yMax - currentView.yMin;
        return {
            x: ((imageX + 1 - currentView.xMin) / viewWidth * this.props.layerWidth),
            y: this.props.layerHeight - ((imageY + 1 - currentView.yMin) / viewHeight * this.props.layerHeight)
        };
    }

    render() {
        const region = this.props.region;
        const frame = this.props.frame;
        const centerImageSpace = region.controlPoints[0];

        const centerPixelSpace = this.getCanvasPos(centerImageSpace.x, centerImageSpace.y);
        const width = (region.controlPoints[1].x * frame.zoomLevel);
        const height = (region.controlPoints[1].y * frame.zoomLevel);

        // Adjusts the dash length to force the total number of dashes around the bounding box perimeter to 50
        const borderDash = [(width + height) * 4 / 100.0];

        return (
            <Group>
                {region.regionType === RegionType.RECTANGLE &&
                <Group>
                    <Rect
                        rotation={region.rotation}
                        x={centerPixelSpace.x + 0.5}
                        y={centerPixelSpace.y + 0.5}
                        width={width}
                        height={height}
                        offsetX={width / 2.0}
                        offsetY={height / 2.0}
                        stroke={Colors.WHITE}
                        dash={region.creating ? borderDash : null}
                        strokeWidth={3}
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                    <Rect
                        rotation={region.rotation}
                        x={centerPixelSpace.x + 0.5}
                        y={centerPixelSpace.y + 0.5}
                        width={width}
                        height={height}
                        offsetX={width / 2.0}
                        offsetY={height / 2.0}
                        stroke={Colors.BLACK}
                        strokeWidth={1}
                        dash={region.creating ? borderDash : null}
                        draggable={true}
                        listening={this.props.listening}
                        onDragStart={this.handleDragStart}
                        onDragEnd={this.handleDragEnd}
                        onDragMove={this.handleDrag}
                        onClick={this.handleClick}
                        perfectDrawEnabled={false}
                        ref={this.handleRef}
                    />

                </Group>
                }
                {region.regionType === RegionType.ELLIPSE &&
                <Group>
                    <Ellipse
                        rotation={region.rotation}
                        x={centerPixelSpace.x + 0.5}
                        y={centerPixelSpace.y + 0.5}
                        radius={{x: width, y: height}}
                        stroke={Colors.WHITE}
                        strokeWidth={3}
                        dash={region.creating ? borderDash : null}
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                    <Ellipse
                        rotation={region.rotation}
                        x={centerPixelSpace.x + 0.5}
                        y={centerPixelSpace.y + 0.5}
                        radius={{x: width, y: height}}
                        stroke={Colors.BLACK}
                        strokeWidth={1}
                        dash={region.creating ? borderDash : null}
                        draggable={true}
                        listening={this.props.listening}
                        onDragStart={this.handleDragStart}
                        onDragEnd={this.handleDragEnd}
                        onDragMove={this.handleDrag}
                        onClick={this.handleClick}
                        fillEnabled={true}
                        perfectDrawEnabled={false}
                        ref={this.handleRef}
                    />
                </Group>
                }
                {this.selectedRegionRef && this.props.selected && this.props.listening &&
                <Transformer
                    node={this.selectedRegionRef}
                    rotateAnchorOffset={15}
                    anchorSize={6}
                    borderStroke={Colors.GREEN4}
                    borderDash={region.regionType === RegionType.ELLIPSE ? borderDash : null}
                    keepRatio={false}
                    centeredScaling={this.centeredScaling}
                    draggable={false}
                    borderEnabled={false}
                    onTransformStart={this.handleTransformStart}
                    onTransform={this.handleTransform}
                    onTransformEnd={this.handleTransformEnd}
                />
                }
            </Group>
        );
    }
}